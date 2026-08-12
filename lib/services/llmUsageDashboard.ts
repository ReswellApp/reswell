/**
 * Admin LLM usage dashboard — models in use + Vercel AI Gateway spend.
 */

import { gateway } from "ai"
import {
  APP_LLM_FEATURES,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
  type AppLlmFeatureDefinition,
  type AppLlmFeatureId,
  type LlmTransport,
} from "@/lib/llm/app-models"

const ALLOWED_RANGE_DAYS = new Set([7, 14, 30, 90])

export type LlmUsageRangeDays = 7 | 14 | 30 | 90

export interface LlmUsageMetricRow {
  key: string
  label: string
  totalCostUsd: number
  marketCostUsd: number
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  requestCount: number
}

export interface LlmUsageDailyPoint {
  day: string
  totalCostUsd: number
  requestCount: number
  inputTokens: number
  outputTokens: number
}

export interface LlmAppFeatureStatus {
  id: AppLlmFeatureId
  name: string
  purpose: string
  transport: LlmTransport
  model: string
  enabled: boolean
  gatewayFeatureTag: string | null
  surfaces: string[]
  sourceFiles: string[]
  /** Spend attributed via gateway tag for the selected range (null when not on Gateway). */
  rangeCostUsd: number | null
  rangeRequestCount: number | null
}

export interface LlmGatewayModelInfo {
  id: string
  name: string
  description: string | null
  ownedBy: string
  pricingInputPerMillion: number | null
  pricingOutputPerMillion: number | null
  usedByApp: boolean
  rangeCostUsd: number
  rangeRequestCount: number
}

export interface LlmUsageDashboard {
  rangeDays: LlmUsageRangeDays
  startDate: string
  endDate: string
  generatedAt: string
  gatewayConfigured: boolean
  gatewayError: string | null
  credits: {
    balanceUsd: number | null
    totalUsedUsd: number | null
  }
  totals: {
    totalCostUsd: number
    marketCostUsd: number
    requestCount: number
    inputTokens: number
    outputTokens: number
    cachedInputTokens: number
  }
  byDay: LlmUsageDailyPoint[]
  byModel: LlmUsageMetricRow[]
  byProvider: LlmUsageMetricRow[]
  byFeatureTag: LlmUsageMetricRow[]
  features: LlmAppFeatureStatus[]
  gatewayModels: LlmGatewayModelInfo[]
  notes: string[]
}

function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function rangeBounds(days: LlmUsageRangeDays): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return { startDate: utcYmd(start), endDate: utcYmd(end) }
}

function parseUsd(value: string | number | null | undefined): number | null {
  if (value == null) return null
  const n = typeof value === "number" ? value : Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

function sumRows(
  rows: Array<{
    totalCost?: number
    marketCost?: number
    inputTokens?: number
    outputTokens?: number
    cachedInputTokens?: number
    requestCount?: number
  }>,
): {
  totalCostUsd: number
  marketCostUsd: number
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  requestCount: number
} {
  let totalCostUsd = 0
  let marketCostUsd = 0
  let inputTokens = 0
  let outputTokens = 0
  let cachedInputTokens = 0
  let requestCount = 0
  for (const row of rows) {
    totalCostUsd += row.totalCost ?? 0
    marketCostUsd += row.marketCost ?? 0
    inputTokens += row.inputTokens ?? 0
    outputTokens += row.outputTokens ?? 0
    cachedInputTokens += row.cachedInputTokens ?? 0
    requestCount += row.requestCount ?? 0
  }
  return {
    totalCostUsd,
    marketCostUsd,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    requestCount,
  }
}

function toMetricRows<T extends {
  totalCost?: number
  marketCost?: number
  inputTokens?: number
  outputTokens?: number
  cachedInputTokens?: number
  requestCount?: number
}>(
  rows: T[],
  keyOf: (row: T) => string | undefined,
): LlmUsageMetricRow[] {
  return rows
    .map((row) => {
      const key = keyOf(row)?.trim()
      if (!key) return null
      return {
        key,
        label: key,
        totalCostUsd: row.totalCost ?? 0,
        marketCostUsd: row.marketCost ?? 0,
        inputTokens: row.inputTokens ?? 0,
        outputTokens: row.outputTokens ?? 0,
        cachedInputTokens: row.cachedInputTokens ?? 0,
        requestCount: row.requestCount ?? 0,
      } satisfies LlmUsageMetricRow
    })
    .filter((row): row is LlmUsageMetricRow => row != null)
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd || b.requestCount - a.requestCount)
}

function perMillionFromPerToken(perToken: string | undefined | null): number | null {
  if (!perToken) return null
  const n = Number.parseFloat(perToken)
  if (!Number.isFinite(n)) return null
  return n * 1_000_000
}

function gatewayAuthConfigured(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim(),
  )
}

function featureStatus(
  feature: AppLlmFeatureDefinition,
  tagSpend: Map<string, { cost: number; requests: number }>,
): LlmAppFeatureStatus {
  const tag = feature.gatewayFeatureTag
  const spend = tag ? tagSpend.get(tag) : undefined
  return {
    id: feature.id,
    name: feature.name,
    purpose: feature.purpose,
    transport: feature.transport,
    model: resolveConfiguredModel(feature),
    enabled: isAppLlmFeatureEnabled(feature),
    gatewayFeatureTag: feature.gatewayFeatureTag,
    surfaces: [...feature.surfaces],
    sourceFiles: [...feature.sourceFiles],
    rangeCostUsd: feature.transport === "vercel_ai_gateway" ? (spend?.cost ?? 0) : null,
    rangeRequestCount:
      feature.transport === "vercel_ai_gateway" ? (spend?.requests ?? 0) : null,
  }
}

function humanizeGatewayError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/401|unauthorized|authentication/i.test(message)) {
    return "AI Gateway auth failed. Set AI_GATEWAY_API_KEY or run `vercel env pull` for OIDC."
  }
  if (/403|forbidden|pro|enterprise|not available/i.test(message)) {
    return "Spend reports require a Vercel plan with AI Gateway Custom Reporting access."
  }
  if (/429|rate/i.test(message)) {
    return "AI Gateway reporting rate-limited this request. Try again in a moment."
  }
  return message.length > 240 ? `${message.slice(0, 237)}…` : message
}

export function parseLlmUsageRangeDays(raw: string | null): LlmUsageRangeDays {
  const n = Number.parseInt(raw ?? "", 10)
  if (ALLOWED_RANGE_DAYS.has(n)) return n as LlmUsageRangeDays
  return 30
}

export async function getLlmUsageDashboard(options?: {
  days?: LlmUsageRangeDays
}): Promise<LlmUsageDashboard> {
  const rangeDays = options?.days ?? 30
  const { startDate, endDate } = rangeBounds(rangeDays)
  const generatedAt = new Date().toISOString()
  const notes: string[] = [
    "Gateway spend is account-scoped (Custom Reporting). Tag-based feature attribution starts after requests include gateway tags.",
    "Listing description generation uses Anthropic directly and is not included in AI Gateway totals.",
  ]

  const emptyTotals = {
    totalCostUsd: 0,
    marketCostUsd: 0,
    requestCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
  }

  if (!gatewayAuthConfigured()) {
    return {
      rangeDays,
      startDate,
      endDate,
      generatedAt,
      gatewayConfigured: false,
      gatewayError:
        "AI Gateway is not configured. Add AI_GATEWAY_API_KEY or pull VERCEL_OIDC_TOKEN via `vercel env pull`.",
      credits: { balanceUsd: null, totalUsedUsd: null },
      totals: emptyTotals,
      byDay: [],
      byModel: [],
      byProvider: [],
      byFeatureTag: [],
      features: APP_LLM_FEATURES.map((f) => featureStatus(f, new Map())),
      gatewayModels: [],
      notes,
    }
  }

  let gatewayError: string | null = null
  let credits = { balanceUsd: null as number | null, totalUsedUsd: null as number | null }
  let byDay: LlmUsageDailyPoint[] = []
  let byModel: LlmUsageMetricRow[] = []
  let byProvider: LlmUsageMetricRow[] = []
  let byFeatureTag: LlmUsageMetricRow[] = []
  let gatewayModels: LlmGatewayModelInfo[] = []
  let totals = emptyTotals

  try {
    const [creditsSettled, daySettled, modelSettled, providerSettled, tagSettled, modelsSettled] =
      await Promise.allSettled([
        gateway.getCredits(),
        gateway.getSpendReport({ startDate, endDate, groupBy: "day", datePart: "day" }),
        gateway.getSpendReport({ startDate, endDate, groupBy: "model" }),
        gateway.getSpendReport({ startDate, endDate, groupBy: "provider" }),
        gateway.getSpendReport({ startDate, endDate, groupBy: "tag" }),
        gateway.getAvailableModels(),
      ])

    if (creditsSettled.status === "fulfilled") {
      credits = {
        balanceUsd: parseUsd(creditsSettled.value.balance),
        totalUsedUsd: parseUsd(creditsSettled.value.totalUsed),
      }
    } else {
      gatewayError = humanizeGatewayError(creditsSettled.reason)
      console.error("[llmUsageDashboard] credits", creditsSettled.reason)
    }

    const reportError =
      daySettled.status === "rejected"
        ? daySettled.reason
        : modelSettled.status === "rejected"
          ? modelSettled.reason
          : providerSettled.status === "rejected"
            ? providerSettled.reason
            : tagSettled.status === "rejected"
              ? tagSettled.reason
              : null

    if (reportError) {
      const msg = humanizeGatewayError(reportError)
      gatewayError = gatewayError ? `${gatewayError} ${msg}` : msg
      console.error("[llmUsageDashboard] spend report", reportError)
    }

    if (daySettled.status === "fulfilled") {
      byDay = daySettled.value.results
        .map((row) => ({
          day: row.day ?? "",
          totalCostUsd: row.totalCost ?? 0,
          requestCount: row.requestCount ?? 0,
          inputTokens: row.inputTokens ?? 0,
          outputTokens: row.outputTokens ?? 0,
        }))
        .filter((row) => row.day)
        .sort((a, b) => a.day.localeCompare(b.day))
    }

    if (modelSettled.status === "fulfilled") {
      byModel = toMetricRows(modelSettled.value.results, (row) => row.model)
      totals = sumRows(modelSettled.value.results)
    }

    if (providerSettled.status === "fulfilled") {
      byProvider = toMetricRows(providerSettled.value.results, (row) => row.provider)
    }

    if (tagSettled.status === "fulfilled") {
      byFeatureTag = toMetricRows(tagSettled.value.results, (row) => row.tag)
    }

    const modelsRes =
      modelsSettled.status === "fulfilled" ? modelsSettled.value : { models: [] }
    if (modelsSettled.status === "rejected") {
      console.error("[llmUsageDashboard] models", modelsSettled.reason)
    }

    const usedModelIds = new Set(byModel.map((m) => m.key))
    for (const feature of APP_LLM_FEATURES) {
      if (feature.transport === "vercel_ai_gateway") {
        usedModelIds.add(resolveConfiguredModel(feature))
      }
    }

    const costByModel = new Map(byModel.map((m) => [m.key, m]))

    gatewayModels = modelsRes.models
      .filter((m) => usedModelIds.has(m.id) || (costByModel.get(m.id)?.requestCount ?? 0) > 0)
      .map((m) => {
        const spend = costByModel.get(m.id)
        return {
          id: m.id,
          name: m.name,
          description: m.description ?? null,
          ownedBy: m.id.split("/")[0] ?? "unknown",
          pricingInputPerMillion: perMillionFromPerToken(m.pricing?.input),
          pricingOutputPerMillion: perMillionFromPerToken(m.pricing?.output),
          usedByApp: APP_LLM_FEATURES.some(
            (f) =>
              f.transport === "vercel_ai_gateway" && resolveConfiguredModel(f) === m.id,
          ),
          rangeCostUsd: spend?.totalCostUsd ?? 0,
          rangeRequestCount: spend?.requestCount ?? 0,
        } satisfies LlmGatewayModelInfo
      })
      .sort(
        (a, b) =>
          Number(b.usedByApp) - Number(a.usedByApp) ||
          b.rangeCostUsd - a.rangeCostUsd ||
          a.name.localeCompare(b.name),
      )

    // Include spend rows for models missing from the catalog response.
    for (const row of byModel) {
      if (gatewayModels.some((m) => m.id === row.key)) continue
      gatewayModels.push({
        id: row.key,
        name: row.key,
        description: null,
        ownedBy: row.key.split("/")[0] ?? "unknown",
        pricingInputPerMillion: null,
        pricingOutputPerMillion: null,
        usedByApp: APP_LLM_FEATURES.some(
          (f) =>
            f.transport === "vercel_ai_gateway" && resolveConfiguredModel(f) === row.key,
        ),
        rangeCostUsd: row.totalCostUsd,
        rangeRequestCount: row.requestCount,
      })
    }
  } catch (err) {
    gatewayError = humanizeGatewayError(err)
    console.error("[llmUsageDashboard]", err)
  }

  const tagSpend = new Map<string, { cost: number; requests: number }>()
  for (const row of byFeatureTag) {
    tagSpend.set(row.key, { cost: row.totalCostUsd, requests: row.requestCount })
  }

  return {
    rangeDays,
    startDate,
    endDate,
    generatedAt,
    gatewayConfigured: true,
    gatewayError,
    credits,
    totals,
    byDay,
    byModel,
    byProvider,
    byFeatureTag,
    features: APP_LLM_FEATURES.map((f) => featureStatus(f, tagSpend)),
    gatewayModels,
    notes,
  }
}
