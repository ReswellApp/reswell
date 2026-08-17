/**
 * Maps Reswell Klaviyo metrics to live metric-triggered flows + send-email actions.
 *
 * Strategy:
 * 1. GET /api/metrics?include=flow-triggers → metric name → flow ids + status
 * 2. For each linked flow, GET /api/flows/{id}/flow-actions?filter=SEND_EMAIL
 *    (reliable for every flow; avoids definition-list limitations and 429 false negatives)
 */

import { unstable_cache } from "next/cache"

import {
  klaviyoGetWithRetry,
  klaviyoGetAllPagesWithIncluded,
  mapWithConcurrency,
} from "@/lib/klaviyo/api-client"
import { KNOWN_KLAVIYO_METRIC_NAMES } from "@/lib/klaviyo/event-log-shared"
import type {
  KlaviyoFlowCoverageFlowRow,
  KlaviyoFlowCoverageMetricRow,
  KlaviyoFlowCoverageResult,
  KlaviyoFlowCoverageStatus,
  KlaviyoFlowCoverageTotals,
} from "@/lib/klaviyo/flow-coverage-shared"

const CACHE_SECONDS = 60 * 10
const CACHE_TAG = "klaviyo-flow-coverage"
/** Flow-actions burst is tight — serial + retries avoids 429 → false “no email”. */
const FLOW_EMAIL_CHECK_CONCURRENCY = 1

type KlaviyoMetricResource = {
  type: string
  id: string
  attributes?: { name?: string }
  relationships?: {
    "flow-triggers"?: {
      data?: { type: string; id: string }[] | null
    }
  }
}

type KlaviyoFlowResource = {
  type: string
  id: string
  attributes?: {
    name?: string
    status?: string
    archived?: boolean
    trigger_type?: string
  }
}

type FlowActionsCollection = {
  data?: unknown[]
}

export class KlaviyoFlowCoverageError extends Error {
  readonly status: number
  readonly missingKey: boolean
  readonly scopeHint: boolean

  constructor(
    message: string,
    opts: { status?: number; missingKey?: boolean; scopeHint?: boolean } = {},
  ) {
    super(message)
    this.name = "KlaviyoFlowCoverageError"
    this.status = opts.status ?? 0
    this.missingKey = opts.missingKey ?? false
    this.scopeHint = opts.scopeHint ?? false
  }
}

function normalizeFlowStatus(raw: string | undefined): string {
  return (raw ?? "").trim().toLowerCase()
}

function classifyCoverage(
  flows: KlaviyoFlowCoverageFlowRow[],
  metricExistsInAccount: boolean,
): {
  coverage: KlaviyoFlowCoverageStatus
  hasLiveFlow: boolean
  hasLiveEmail: boolean
} {
  if (flows.length === 0) {
    return {
      coverage: metricExistsInAccount ? "no_flow" : "metric_missing",
      hasLiveFlow: false,
      hasLiveEmail: false,
    }
  }

  const live = flows.filter((f) => f.status === "live")
  const hasLiveFlow = live.length > 0
  const hasLiveEmail = live.some((f) => f.hasEmailAction)

  if (hasLiveEmail) {
    return { coverage: "covered", hasLiveFlow, hasLiveEmail }
  }
  if (hasLiveFlow) {
    return { coverage: "live_no_email", hasLiveFlow, hasLiveEmail: false }
  }
  return { coverage: "draft_or_manual", hasLiveFlow: false, hasLiveEmail: false }
}

function emptyTotals(): KlaviyoFlowCoverageTotals {
  return {
    covered: 0,
    liveNoEmail: 0,
    draftOrManual: 0,
    noFlow: 0,
    metricMissing: 0,
    total: 0,
  }
}

function tallyTotals(rows: KlaviyoFlowCoverageMetricRow[]): KlaviyoFlowCoverageTotals {
  const totals = emptyTotals()
  totals.total = rows.length
  for (const row of rows) {
    switch (row.coverage) {
      case "covered":
        totals.covered += 1
        break
      case "live_no_email":
        totals.liveNoEmail += 1
        break
      case "draft_or_manual":
        totals.draftOrManual += 1
        break
      case "no_flow":
        totals.noFlow += 1
        break
      case "metric_missing":
        totals.metricMissing += 1
        break
    }
  }
  return totals
}

function throwFromKlaviyoFailure(
  kind: "metrics" | "flows",
  result: { status: number; detail: string; missingKey?: boolean },
): never {
  const scopeHint = result.status === 403 || result.status === 401
  const scopeName = kind === "metrics" ? "metrics:read" : "flows:read"
  throw new KlaviyoFlowCoverageError(
    result.missingKey
      ? "KLAVIYO_API_KEY not set"
      : scopeHint
        ? `Klaviyo rejected ${scopeName} — ensure the private API key includes flows:read and metrics:read scopes.`
        : `Failed to list Klaviyo ${kind} (${result.status}): ${result.detail}`,
    {
      status: result.status,
      missingKey: result.missingKey,
      scopeHint,
    },
  )
}

async function flowHasSendEmailAction(flowId: string): Promise<boolean | null> {
  const res = await klaviyoGetWithRetry<FlowActionsCollection>(
    `/api/flows/${flowId}/flow-actions/`,
    { filter: 'equals(action_type,"SEND_EMAIL")' },
  )
  if (!res.ok) {
    console.warn(
      `[klaviyo] flow-actions SEND_EMAIL check failed for ${flowId}:`,
      res.status,
      res.detail.slice(0, 200),
    )
    return null
  }
  return Array.isArray(res.data.data) && res.data.data.length > 0
}

async function fetchFlowCoverageUncached(): Promise<KlaviyoFlowCoverageResult> {
  const metricsPage = await klaviyoGetAllPagesWithIncluded<
    KlaviyoMetricResource,
    KlaviyoFlowResource
  >("/api/metrics", {
    include: "flow-triggers",
    "fields[metric]": "name",
    "fields[flow]": "name,status,archived,trigger_type",
  })

  if (!metricsPage.ok) throwFromKlaviyoFailure("metrics", metricsPage)

  const metricNamesInAccount = new Set<string>()
  const flowById = new Map<string, KlaviyoFlowResource>()
  for (const flow of metricsPage.data.included) {
    if (flow.type === "flow") flowById.set(flow.id, flow)
  }

  const knownNameSet = new Set(KNOWN_KLAVIYO_METRIC_NAMES)

  const flowIdsByMetricName = new Map<string, string[]>()
  const flowIdsNeeded = new Set<string>()

  for (const metric of metricsPage.data.items) {
    const name = metric.attributes?.name?.trim()
    if (!name) continue
    metricNamesInAccount.add(name)

    if (!knownNameSet.has(name)) continue

    const rel = metric.relationships?.["flow-triggers"]?.data ?? []
    const ids: string[] = []
    for (const ref of rel) {
      if (!ref?.id) continue
      const flow = flowById.get(ref.id)
      if (flow?.attributes?.archived) continue
      ids.push(ref.id)
      flowIdsNeeded.add(ref.id)
    }
    if (ids.length > 0) flowIdsByMetricName.set(name, ids)
  }

  // Same email check for every linked flow (not just a subset).
  const emailByFlowId = new Map<string, boolean>()
  const flowIds = [...flowIdsNeeded]

  const emailResults = await mapWithConcurrency(
    flowIds,
    FLOW_EMAIL_CHECK_CONCURRENCY,
    async (flowId) => {
      const hasEmail = await flowHasSendEmailAction(flowId)
      return { flowId, hasEmail }
    },
  )

  for (const { flowId, hasEmail } of emailResults) {
    // null (exhausted retries) → false; prefer under-claim covered over false positives
    emailByFlowId.set(flowId, hasEmail === true)
  }

  const flowsByMetricName = new Map<string, KlaviyoFlowCoverageFlowRow[]>()

  for (const [metricName, flowIdsForMetric] of flowIdsByMetricName) {
    const rows: KlaviyoFlowCoverageFlowRow[] = []
    for (const flowId of flowIdsForMetric) {
      const flow = flowById.get(flowId)
      if (!flow || flow.attributes?.archived) continue
      rows.push({
        id: flowId,
        name: flow.attributes?.name?.trim() || flowId,
        status: normalizeFlowStatus(flow.attributes?.status),
        hasEmailAction: emailByFlowId.get(flowId) === true,
      })
    }
    if (rows.length > 0) flowsByMetricName.set(metricName, rows)
  }

  const metricNames = new Set<string>(KNOWN_KLAVIYO_METRIC_NAMES)

  const byMetric: KlaviyoFlowCoverageMetricRow[] = [...metricNames]
    .sort((a, b) => a.localeCompare(b))
    .map((metric) => {
      const flows = flowsByMetricName.get(metric) ?? []
      const exists = metricNamesInAccount.has(metric)
      const { coverage, hasLiveFlow, hasLiveEmail } = classifyCoverage(flows, exists)
      return { metric, coverage, hasLiveFlow, hasLiveEmail, flows }
    })

  return {
    fetchedAt: new Date().toISOString(),
    byMetric,
    totals: tallyTotals(byMetric),
  }
}

const getCachedFlowCoverage = unstable_cache(
  async () => fetchFlowCoverageUncached(),
  ["klaviyo-flow-coverage-v4"],
  { revalidate: CACHE_SECONDS, tags: [CACHE_TAG] },
)

/**
 * Load metric → flow coverage. Cached ~10 minutes unless `refresh` is true.
 */
export async function getKlaviyoFlowCoverage(opts?: {
  refresh?: boolean
}): Promise<KlaviyoFlowCoverageResult> {
  if (opts?.refresh) {
    return fetchFlowCoverageUncached()
  }
  return getCachedFlowCoverage()
}
