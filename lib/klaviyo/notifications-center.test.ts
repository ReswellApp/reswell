import assert from "node:assert/strict"
import { register } from "node:module"
import { before, describe, it } from "node:test"

import type { KlaviyoMetricRow } from "./event-log-shared.ts"
import type { KlaviyoFlowDirectoryRow } from "./flow-coverage-shared.ts"

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { pathToFileURL } from "node:url"
import { join } from "node:path"
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const abs = join(${JSON.stringify("/workspace")}, specifier.slice(2))
    const file = abs.endsWith(".ts") ? abs : abs + ".ts"
    return { url: pathToFileURL(file).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
`),
)

let alerts: typeof import("./event-log-shared.ts")
let flows: typeof import("./flow-coverage-shared.ts")
let stats: typeof import("./flow-stats-shared.ts")

before(async () => {
  alerts = await import("./event-log-shared.ts")
  flows = await import("./flow-coverage-shared.ts")
  stats = await import("./flow-stats-shared.ts")
})

function metric(partial: Partial<KlaviyoMetricRow> & Pick<KlaviyoMetricRow, "metric">): KlaviyoMetricRow {
  return {
    category: "transactional",
    total: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    uniqueRecipients: 0,
    ...partial,
  }
}

function flow(partial: Partial<KlaviyoFlowDirectoryRow> & Pick<KlaviyoFlowDirectoryRow, "id">): KlaviyoFlowDirectoryRow {
  return {
    name: partial.id,
    status: "live",
    archived: false,
    triggerKind: "metric",
    triggerLabel: "Order Shipped",
    triggerMetrics: ["Order Shipped"],
    hasEmail: true,
    hasSms: false,
    updatedAt: null,
    ...partial,
  }
}

describe("formatCountDelta", () => {
  it("describes a percent change against the prior window", () => {
    assert.equal(alerts.formatCountDelta(15, 10), "+50% vs prior period")
    assert.equal(alerts.formatCountDelta(5, 10), "-50% vs prior period")
    assert.equal(alerts.formatCountDelta(0, 0), null)
    assert.equal(alerts.formatCountDelta(4, 0), "New vs prior period")
  })
})

describe("buildNotificationsCenterAlerts", () => {
  it("flags transactional failures and sharp accept drops", () => {
    const found = alerts.buildNotificationsCenterAlerts({
      range: "7d",
      currentByMetric: [
        metric({ metric: "Order Shipped", sent: 4, total: 4 }),
        metric({ metric: "Viewed Product", category: "marketing", sent: 1, failed: 9, total: 10 }),
      ],
      previousByMetric: [metric({ metric: "Order Shipped", sent: 20, total: 20 })],
      failedLast24h: [metric({ metric: "Order Shipped", failed: 2, total: 2 })],
    })

    assert.deepEqual(
      found.map((alert) => alert.id),
      ["fail:Order Shipped", "drop:Order Shipped"],
    )
    assert.match(found[1]?.message ?? "", /prior 7 days/)
  })

  it("ignores small prior volume", () => {
    const found = alerts.buildNotificationsCenterAlerts({
      range: "24h",
      currentByMetric: [metric({ metric: "Order Shipped", sent: 1, total: 1 })],
      previousByMetric: [metric({ metric: "Order Shipped", sent: 4, total: 4 })],
      failedLast24h: [],
    })
    assert.equal(found.length, 0)
  })
})

describe("flow directory", () => {
  it("classifies trigger types and unmapped metric flows", () => {
    assert.equal(flows.klaviyoFlowTriggerKind("Added to List"), "list")
    assert.equal(flows.klaviyoFlowTriggerKind("Date Based"), "date")
    assert.equal(flows.klaviyoFlowTriggerLabel("list", [], "Added to List"), "Added to list")

    const row = flow({
      id: "abc",
      triggerMetrics: ["Custom Metric"],
      triggerLabel: "Custom Metric",
    })
    assert.equal(flows.isUnmappedKlaviyoFlow(row, ["Order Shipped"]), true)
    assert.equal(flows.flowMatchesDirectoryFilter(row, "unmapped", ["Order Shipped"], null), true)
    assert.equal(flows.flowMatchesDirectoryFilter(row, "all", ["Order Shipped"], "Order Shipped"), false)
  })
})

describe("flow series aggregation", () => {
  it("sums messages into one row per flow, channel, and day", () => {
    const rows = stats.aggregateFlowSeriesReport({
      date_times: ["2026-09-01T00:00:00+00:00", "2026-09-02T00:00:00+00:00"],
      results: [
        {
          groupings: { flow_id: "F1", flow_message_id: "M1", send_channel: "email" },
          statistics: {
            recipients: [2, 0],
            delivered: [2, 0],
            opens_unique: [1, 0],
            clicks_unique: [1, 0],
            bounced: [0, 1],
            unsubscribes: [0, 0],
            spam_complaints: [0, 0],
            conversion_value: [10.5, 0],
          },
        },
        {
          groupings: { flow_id: "F1", flow_message_id: "M2", send_channel: "email" },
          statistics: {
            recipients: [3, 1],
            delivered: [3, 1],
            opens_unique: [2, 1],
            clicks_unique: [0, 1],
            bounced: [0, 0],
            conversion_value: [1.25, 0],
          },
        },
      ],
    })

    assert.equal(rows.length, 2)
    const first = rows.find((row) => row.statDate === "2026-09-01")
    assert.equal(first?.recipients, 5)
    assert.equal(first?.opens, 3)
    assert.equal(first?.clicks, 1)
    assert.equal(first?.conversionValue, 11.75)
    assert.equal(rows.find((row) => row.statDate === "2026-09-02")?.bounces, 1)
  })

  it("maps metric aggregate dates to daily counts", () => {
    const rows = stats.aggregateMetricCountSeries({
      metricId: "m1",
      metricName: "Order Shipped",
      dates: ["2026-09-01T00:00:00+00:00"],
      counts: [8],
    })
    assert.deepEqual(rows, [
      { metricId: "m1", metricName: "Order Shipped", statDate: "2026-09-01", eventCount: 8 },
    ])
  })
})

describe("performanceDateWindow", () => {
  it("includes today and starts on the UTC date of the rolling window", () => {
    const window = stats.performanceDateWindow("24h", new Date("2026-09-28T15:00:00.000Z"))
    assert.equal(window.since, "2026-09-27")
    assert.equal(window.until, "2026-09-29")
  })
})
