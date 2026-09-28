import assert from "node:assert/strict"
import { register } from "node:module"
import { before, describe, it } from "node:test"

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

type MoneyModule = typeof import("./money.ts")
type MetricsModule = typeof import("./metrics.ts")
type ScoreModule = typeof import("./score.ts")
type DatesModule = typeof import("./dates.ts")
type ErrorsModule = typeof import("./errors.ts")

let majorToMetaMinor: MoneyModule["majorToMetaMinor"]
let majorToMicros: MoneyModule["majorToMicros"]
let metaMinorToMajor: MoneyModule["metaMinorToMajor"]
let microsToMajor: MoneyModule["microsToMajor"]
let buildMetrics: MetricsModule["buildMetrics"]
let benchmarksFromMetrics: ScoreModule["benchmarksFromMetrics"]
let scoreDelivery: ScoreModule["scoreDelivery"]
let rangeDates: DatesModule["rangeDates"]
let publicAdsError: ErrorsModule["publicAdsError"]

before(async () => {
  const money = await import("./money.ts")
  const metrics = await import("./metrics.ts")
  const score = await import("./score.ts")
  const dates = await import("./dates.ts")
  const errors = await import("./errors.ts")
  majorToMetaMinor = money.majorToMetaMinor
  majorToMicros = money.majorToMicros
  metaMinorToMajor = money.metaMinorToMajor
  microsToMajor = money.microsToMajor
  buildMetrics = metrics.buildMetrics
  benchmarksFromMetrics = score.benchmarksFromMetrics
  scoreDelivery = score.scoreDelivery
  rangeDates = dates.rangeDates
  publicAdsError = errors.publicAdsError
})

describe("ads manager money", () => {
  it("sends a $50 Google budget as 50_000_000 micros", () => {
    assert.equal(majorToMicros(50), "50000000")
    assert.equal(microsToMajor("50000000"), 50)
  })

  it("sends a $50 Meta budget as 5000 minor units, not 50", () => {
    assert.equal(majorToMetaMinor(50, "USD"), "5000")
    assert.equal(metaMinorToMajor("5000", "USD"), 50)
  })

  it("keeps zero-decimal currencies in major units", () => {
    assert.equal(majorToMetaMinor(50, "JPY"), "50")
    assert.equal(metaMinorToMajor("50", "JPY"), 50)
  })
})

describe("ads manager scoring", () => {
  it("marks a cheaper converter as a winner", () => {
    const benchmarks = benchmarksFromMetrics(
      buildMetrics({
        impressions: 10_000,
        clicks: 400,
        spend: 1000,
        conversions: 20,
        conversionValue: 4000,
      }),
    )
    const verdict = scoreDelivery({
      status: "enabled",
      benchmarks,
      metrics: buildMetrics({
        impressions: 2000,
        clicks: 80,
        spend: 100,
        conversions: 5,
        conversionValue: 800,
      }),
    })
    assert.equal(verdict, "winner")
  })

  it("marks spend without conversions as needing work", () => {
    const benchmarks = benchmarksFromMetrics(
      buildMetrics({
        impressions: 10_000,
        clicks: 400,
        spend: 1000,
        conversions: 20,
        conversionValue: 4000,
      }),
    )
    const verdict = scoreDelivery({
      status: "enabled",
      benchmarks,
      metrics: buildMetrics({
        impressions: 3000,
        clicks: 40,
        spend: 80,
        conversions: 0,
        conversionValue: 0,
      }),
    })
    assert.equal(verdict, "loser")
  })

  it("does not judge a new ad with almost no delivery", () => {
    const benchmarks = benchmarksFromMetrics(
      buildMetrics({ impressions: 1, clicks: 1, spend: 1, conversions: 1, conversionValue: 1 }),
    )
    const verdict = scoreDelivery({
      status: "enabled",
      benchmarks,
      metrics: buildMetrics({
        impressions: 40,
        clicks: 1,
        spend: 2,
        conversions: 0,
        conversionValue: 0,
      }),
    })
    assert.equal(verdict, "learning")
  })

  it("marks a paused ad that spent without conversions as needing work", () => {
    const benchmarks = benchmarksFromMetrics(
      buildMetrics({ impressions: 1, clicks: 1, spend: 1, conversions: 1, conversionValue: 4 }),
    )
    const verdict = scoreDelivery({
      status: "paused",
      benchmarks,
      metrics: buildMetrics({
        impressions: 3000,
        clicks: 40,
        spend: 80,
        conversions: 0,
        conversionValue: 0,
      }),
    })
    assert.equal(verdict, "loser")
  })

  it("does not judge a paused ad that never delivered", () => {
    const benchmarks = benchmarksFromMetrics(
      buildMetrics({ impressions: 1, clicks: 1, spend: 1, conversions: 1, conversionValue: 1 }),
    )
    const verdict = scoreDelivery({
      status: "paused",
      benchmarks,
      metrics: buildMetrics({
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        conversionValue: 0,
      }),
    })
    assert.equal(verdict, "paused")
  })
})

describe("ads manager dates and errors", () => {
  it("builds an inclusive UTC range", () => {
    const range = rangeDates(7, new Date("2026-09-28T18:00:00.000Z"))
    assert.equal(range.until, "2026-09-28")
    assert.equal(range.since, "2026-09-22")
  })

  it("strips access tokens from platform errors", () => {
    const message = publicAdsError(new Error("OAuth ya29.abc_DEF failed access_token=secret"))
    assert.equal(message.includes("secret"), false)
    assert.equal(message.includes("ya29"), false)
  })
})
