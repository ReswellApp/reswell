import type { PeerListingSection } from "@/lib/peer-listing-sections"
import type { SellFunnelAnalyticsDashboard } from "@/lib/types/sellFunnelAnalytics"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { createServiceRoleClient } from "@/lib/supabase/server"

export async function fetchAdminSellFunnelDashboard(input: {
  days: number
  listingType?: PeerListingSection
}): Promise<{ ok: true; data: SellFunnelAnalyticsDashboard } | { ok: false; error: string }> {
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase.rpc("admin_sell_funnel_dashboard", {
      p_days: input.days,
      p_listing_type: input.listingType ?? null,
    })
    if (error) return { ok: false, error: error.message }

    const parsed = parseSellFunnelDashboardJson(data)
    if (!parsed) return { ok: false, error: "Invalid dashboard payload" }

    return { ok: true, data: parsed }
  } catch {
    return { ok: false, error: "Failed to load sell funnel analytics" }
  }
}

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return Math.trunc(n)
  }
  return null
}

function asFloat(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function parseSellFunnelDashboardJson(raw: unknown): SellFunnelAnalyticsDashboard | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>

  const days = asInt(o.days)
  if (days == null || days < 1) return null

  const listingTypeRaw = o.listingTypeFilter
  const listingTypeFilter =
    listingTypeRaw == null
      ? null
      : typeof listingTypeRaw === "string" && isPeerListingSection(listingTypeRaw)
        ? listingTypeRaw
        : null

  const summaryRaw = o.summary
  if (!summaryRaw || typeof summaryRaw !== "object") return null
  const s = summaryRaw as Record<string, unknown>

  const summary = {
    publishAttempts: asInt(s.publishAttempts) ?? 0,
    publishSuccesses: asInt(s.publishSuccesses) ?? 0,
    validationFailures: asInt(s.validationFailures) ?? 0,
    uploadFailures: asInt(s.uploadFailures) ?? 0,
    publishFailures: asInt(s.publishFailures) ?? 0,
    flowStarts: asInt(s.flowStarts) ?? 0,
    uniqueUsers: asInt(s.uniqueUsers) ?? 0,
    medianDurationMs: asFloat(s.medianDurationMs),
    successRate: asFloat(s.successRate),
  }

  const byEvent = parseEventRows(o.byEvent)
  const byListingType = parseListingTypeRows(o.byListingType)
  const topValidationFailures = parseValidationRows(o.topValidationFailures)
  const stepFunnel = parseStepRows(o.stepFunnel)
  const dailyTrend = parseDailyRows(o.dailyTrend)
  const recentEvents = parseRecentRows(o.recentEvents)

  if (
    byEvent == null ||
    byListingType == null ||
    topValidationFailures == null ||
    stepFunnel == null ||
    dailyTrend == null ||
    recentEvents == null
  ) {
    return null
  }

  return {
    days,
    listingTypeFilter,
    summary,
    byEvent,
    byListingType,
    topValidationFailures,
    stepFunnel,
    dailyTrend,
    recentEvents,
  }
}

function parseEventRows(raw: unknown): SellFunnelAnalyticsDashboard["byEvent"] | null {
  if (!Array.isArray(raw)) return null
  const rows: SellFunnelAnalyticsDashboard["byEvent"] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const r = item as Record<string, unknown>
    const event = asString(r.event)
    const count = asInt(r.count)
    const uniqueUsers = asInt(r.uniqueUsers)
    if (!event || count == null || uniqueUsers == null) return null
    rows.push({ event, count, uniqueUsers })
  }
  return rows
}

function parseListingTypeRows(
  raw: unknown,
): SellFunnelAnalyticsDashboard["byListingType"] | null {
  if (!Array.isArray(raw)) return null
  const rows: SellFunnelAnalyticsDashboard["byListingType"] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const r = item as Record<string, unknown>
    const listingType = asString(r.listingType)
    const publishAttempts = asInt(r.publishAttempts)
    const publishSuccesses = asInt(r.publishSuccesses)
    const validationFailures = asInt(r.validationFailures)
    const flowStarts = asInt(r.flowStarts)
    if (
      !listingType ||
      publishAttempts == null ||
      publishSuccesses == null ||
      validationFailures == null ||
      flowStarts == null
    ) {
      return null
    }
    rows.push({
      listingType,
      publishAttempts,
      publishSuccesses,
      validationFailures,
      flowStarts,
    })
  }
  return rows
}

function parseValidationRows(
  raw: unknown,
): SellFunnelAnalyticsDashboard["topValidationFailures"] | null {
  if (!Array.isArray(raw)) return null
  const rows: SellFunnelAnalyticsDashboard["topValidationFailures"] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const r = item as Record<string, unknown>
    const field = asString(r.field)
    const message = asString(r.message) ?? ""
    const count = asInt(r.count)
    if (!field || count == null) return null
    rows.push({ field, message, count })
  }
  return rows
}

function parseStepRows(raw: unknown): SellFunnelAnalyticsDashboard["stepFunnel"] | null {
  if (!Array.isArray(raw)) return null
  const rows: SellFunnelAnalyticsDashboard["stepFunnel"] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const r = item as Record<string, unknown>
    const step = asString(r.step)
    const viewed = asInt(r.viewed)
    const completed = asInt(r.completed)
    if (!step || viewed == null || completed == null) return null
    rows.push({ step, viewed, completed })
  }
  return rows
}

function parseDailyRows(raw: unknown): SellFunnelAnalyticsDashboard["dailyTrend"] | null {
  if (!Array.isArray(raw)) return null
  const rows: SellFunnelAnalyticsDashboard["dailyTrend"] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const r = item as Record<string, unknown>
    const date = asString(r.date)
    const publishAttempts = asInt(r.publishAttempts)
    const publishSuccesses = asInt(r.publishSuccesses)
    if (!date || publishAttempts == null || publishSuccesses == null) return null
    rows.push({ date, publishAttempts, publishSuccesses })
  }
  return rows
}

function parseRecentRows(raw: unknown): SellFunnelAnalyticsDashboard["recentEvents"] | null {
  if (!Array.isArray(raw)) return null
  const rows: SellFunnelAnalyticsDashboard["recentEvents"] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const r = item as Record<string, unknown>
    const id = asString(r.id)
    const createdAt = asString(r.createdAt)
    const listingType = asString(r.listingType)
    const event = asString(r.event)
    if (!id || !createdAt || !listingType || !event) return null
    rows.push({
      id,
      createdAt,
      userId: asString(r.userId),
      listingType,
      event,
      field: asString(r.field),
      message: asString(r.message),
      listingId: asString(r.listingId),
      durationMs: asInt(r.durationMs),
    })
  }
  return rows
}
