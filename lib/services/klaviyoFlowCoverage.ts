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
  klaviyoGetAllPages,
  klaviyoGetAllPagesWithIncluded,
  mapWithConcurrency,
} from "@/lib/klaviyo/api-client"
import { KNOWN_KLAVIYO_METRIC_NAMES } from "@/lib/klaviyo/event-log-shared"
import {
  klaviyoFlowTriggerKind,
  klaviyoFlowTriggerLabel,
  summarizeFlowDirectory,
  type KlaviyoFlowCoverageFlowRow,
  type KlaviyoFlowCoverageMetricRow,
  type KlaviyoFlowCoverageResult,
  type KlaviyoFlowCoverageStatus,
  type KlaviyoFlowCoverageTotals,
  type KlaviyoFlowDirectoryRow,
} from "@/lib/klaviyo/flow-coverage-shared"

const CACHE_SECONDS = 60 * 10
const CACHE_TAG = "klaviyo-flow-coverage"
/** Flow-actions burst is tight. Low concurrency avoids 429s turning into false gaps. */
const FLOW_CHANNEL_CHECK_CONCURRENCY = 2

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

type FlowActionResource = {
  attributes?: { action_type?: string }
}

type ListedFlowResource = {
  id: string
  attributes?: {
    name?: string
    status?: string
    archived?: boolean
    trigger_type?: string
    updated?: string
  }
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

async function fetchFlowChannels(
  flowId: string,
): Promise<{ email: boolean | null; sms: boolean | null }> {
  const res = await klaviyoGetAllPages<FlowActionResource>(
    `/api/flows/${flowId}/flow-actions/`,
    { "fields[flow-action]": "action_type" },
    { maxPages: 5 },
  )
  if (!res.ok) {
    console.warn(
      `[klaviyo] flow-actions check failed for ${flowId}:`,
      res.status,
      res.detail.slice(0, 200),
    )
    return { email: null, sms: null }
  }
  let email = false
  let sms = false
  for (const action of res.data) {
    const type = (action.attributes?.action_type ?? "").toUpperCase()
    if (type === "SEND_EMAIL") email = true
    if (type === "SEND_SMS") sms = true
  }
  return { email, sms }
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

  const metricsByFlowId = new Map<string, string[]>()

  for (const metric of metricsPage.data.items) {
    const name = metric.attributes?.name?.trim()
    if (!name) continue
    metricNamesInAccount.add(name)

    const rel = metric.relationships?.["flow-triggers"]?.data ?? []
    for (const ref of rel) {
      if (!ref?.id) continue
      const flow = flowById.get(ref.id)
      if (flow?.attributes?.archived) continue
      const existing = metricsByFlowId.get(ref.id) ?? []
      if (!existing.includes(name)) existing.push(name)
      metricsByFlowId.set(ref.id, existing)
    }
  }

  const flowsPage = await klaviyoGetAllPages<ListedFlowResource>(
    "/api/flows/",
    {
      "fields[flow]": "name,status,archived,trigger_type,updated",
      "page[size]": "50",
    },
    { maxPages: 20 },
  )
  if (!flowsPage.ok) throwFromKlaviyoFailure("flows", flowsPage)

  const activeFlowIds = flowsPage.data
    .filter((flow) => flow.attributes?.archived !== true)
    .map((flow) => flow.id)

  const channelResults = await mapWithConcurrency(
    activeFlowIds,
    FLOW_CHANNEL_CHECK_CONCURRENCY,
    async (flowId) => {
      const channels = await fetchFlowChannels(flowId)
      return { flowId, channels }
    },
  )
  const channelsByFlowId = new Map(channelResults.map((row) => [row.flowId, row.channels]))

  const directory: KlaviyoFlowDirectoryRow[] = flowsPage.data
    .map((flow) => {
      const triggerMetrics = metricsByFlowId.get(flow.id) ?? []
      const triggerType = flow.attributes?.trigger_type
      const triggerKind = klaviyoFlowTriggerKind(triggerType)
      const channels = channelsByFlowId.get(flow.id)
      return {
        id: flow.id,
        name: flow.attributes?.name?.trim() || flow.id,
        status: normalizeFlowStatus(flow.attributes?.status),
        archived: flow.attributes?.archived === true,
        triggerKind,
        triggerLabel: klaviyoFlowTriggerLabel(triggerKind, triggerMetrics, triggerType),
        triggerMetrics,
        hasEmail: channels?.email ?? null,
        hasSms: channels?.sms ?? null,
        updatedAt: flow.attributes?.updated?.trim() || null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const byMetric: KlaviyoFlowCoverageMetricRow[] = [...KNOWN_KLAVIYO_METRIC_NAMES]
    .sort((a, b) => a.localeCompare(b))
    .map((metric) => {
      const flows: KlaviyoFlowCoverageFlowRow[] = directory
        .filter((flow) => !flow.archived && flow.triggerMetrics.includes(metric))
        .map((flow) => ({
          id: flow.id,
          name: flow.name,
          status: flow.status,
          hasEmailAction: flow.hasEmail === true,
        }))
      const exists = metricNamesInAccount.has(metric)
      const { coverage, hasLiveFlow, hasLiveEmail } = classifyCoverage(flows, exists)
      return { metric, coverage, hasLiveFlow, hasLiveEmail, flows }
    })

  return {
    fetchedAt: new Date().toISOString(),
    byMetric,
    totals: tallyTotals(byMetric),
    flows: directory,
    flowTotals: summarizeFlowDirectory(directory, KNOWN_KLAVIYO_METRIC_NAMES),
  }
}

const getCachedFlowCoverage = unstable_cache(
  async () => fetchFlowCoverageUncached(),
  ["klaviyo-flow-coverage-v5"],
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
