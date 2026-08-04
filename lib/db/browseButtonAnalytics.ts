import type { BrowseButtonAnalyticsDashboard } from "@/lib/types/browseButtonAnalytics"
import { createServiceRoleClient } from "@/lib/supabase/server"

export async function fetchAdminBrowseButtonClicksDashboard(input: {
  days: number
}): Promise<{ ok: true; data: BrowseButtonAnalyticsDashboard } | { ok: false; error: string }> {
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase.rpc("admin_browse_button_clicks_dashboard", {
      p_days: input.days,
    })
    if (error) return { ok: false, error: error.message }

    const parsed = parseBrowseButtonDashboardJson(data)
    if (!parsed) return { ok: false, error: "Invalid dashboard payload" }

    return { ok: true, data: parsed }
  } catch {
    return { ok: false, error: "Failed to load browse button analytics" }
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

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function parseBrowseButtonDashboardJson(raw: unknown): BrowseButtonAnalyticsDashboard | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>

  const days = asInt(o.days)
  if (days == null || days < 1) return null

  const summaryRaw = o.summary
  if (!summaryRaw || typeof summaryRaw !== "object") return null
  const s = summaryRaw as Record<string, unknown>
  const summary = {
    totalClicks: asInt(s.totalClicks) ?? 0,
    shipToMeClicks: asInt(s.shipToMeClicks) ?? 0,
    filterClicks: asInt(s.filterClicks) ?? 0,
    facetClicks: asInt(s.facetClicks) ?? 0,
    uniqueUsers: asInt(s.uniqueUsers) ?? 0,
  }

  const shipRaw = o.shipToMe
  if (!shipRaw || typeof shipRaw !== "object") return null
  const ship = shipRaw as Record<string, unknown>
  const shipDaily = parseShipDaily(ship.dailyTrend)
  if (shipDaily == null) return null

  const shipToMe = {
    total: asInt(ship.total) ?? 0,
    enabled: asInt(ship.enabled) ?? 0,
    disabled: asInt(ship.disabled) ?? 0,
    uniqueUsers: asInt(ship.uniqueUsers) ?? 0,
    dailyTrend: shipDaily,
  }

  const filterByCategory = parseFilterRows(o.filterByCategory)
  const facetsByCategory = parseFacetRows(o.facetsByCategory)
  const dailyTrend = parseDailyRows(o.dailyTrend)
  const recentEvents = parseRecentRows(o.recentEvents)

  if (
    filterByCategory == null ||
    facetsByCategory == null ||
    dailyTrend == null ||
    recentEvents == null
  ) {
    return null
  }

  return {
    days,
    summary,
    shipToMe,
    filterByCategory,
    facetsByCategory,
    dailyTrend,
    recentEvents,
  }
}

function parseShipDaily(
  raw: unknown,
): BrowseButtonAnalyticsDashboard["shipToMe"]["dailyTrend"] | null {
  if (!Array.isArray(raw)) return null
  const rows: BrowseButtonAnalyticsDashboard["shipToMe"]["dailyTrend"] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const r = item as Record<string, unknown>
    const date = asString(r.date)
    const count = asInt(r.count)
    if (!date || count == null) return null
    rows.push({ date, count })
  }
  return rows
}

function parseFilterRows(
  raw: unknown,
): BrowseButtonAnalyticsDashboard["filterByCategory"] | null {
  if (!Array.isArray(raw)) return null
  const rows: BrowseButtonAnalyticsDashboard["filterByCategory"] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const r = item as Record<string, unknown>
    const category = asString(r.category)
    const count = asInt(r.count)
    const uniqueUsers = asInt(r.uniqueUsers)
    const mobile = asInt(r.mobile)
    const desktop = asInt(r.desktop)
    if (
      !category ||
      count == null ||
      uniqueUsers == null ||
      mobile == null ||
      desktop == null
    ) {
      return null
    }
    rows.push({ category, count, uniqueUsers, mobile, desktop })
  }
  return rows
}

function parseFacetRows(
  raw: unknown,
): BrowseButtonAnalyticsDashboard["facetsByCategory"] | null {
  if (!Array.isArray(raw)) return null
  const rows: BrowseButtonAnalyticsDashboard["facetsByCategory"] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const r = item as Record<string, unknown>
    const category = asString(r.category)
    const facetKey = asString(r.facetKey)
    const facetValue = asString(r.facetValue)
    const count = asInt(r.count)
    const selectCount = asInt(r.selectCount)
    const deselectCount = asInt(r.deselectCount)
    const setCount = asInt(r.setCount)
    const uniqueUsers = asInt(r.uniqueUsers)
    if (
      !category ||
      !facetKey ||
      !facetValue ||
      count == null ||
      selectCount == null ||
      deselectCount == null ||
      setCount == null ||
      uniqueUsers == null
    ) {
      return null
    }
    rows.push({
      category,
      facetKey,
      facetValue,
      count,
      selectCount,
      deselectCount,
      setCount,
      uniqueUsers,
    })
  }
  return rows
}

function parseDailyRows(
  raw: unknown,
): BrowseButtonAnalyticsDashboard["dailyTrend"] | null {
  if (!Array.isArray(raw)) return null
  const rows: BrowseButtonAnalyticsDashboard["dailyTrend"] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const r = item as Record<string, unknown>
    const date = asString(r.date)
    const shipToMe = asInt(r.shipToMe)
    const filter = asInt(r.filter)
    const facet = asInt(r.facet) ?? 0
    if (!date || shipToMe == null || filter == null) return null
    rows.push({ date, shipToMe, filter, facet })
  }
  return rows
}

function parseRecentRows(
  raw: unknown,
): BrowseButtonAnalyticsDashboard["recentEvents"] | null {
  if (!Array.isArray(raw)) return null
  const rows: BrowseButtonAnalyticsDashboard["recentEvents"] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const r = item as Record<string, unknown>
    const id = asString(r.id)
    const createdAt = asString(r.createdAt)
    const category = asString(r.category)
    const button = asString(r.button)
    if (!id || !createdAt || !category || !button) return null
    rows.push({
      id,
      createdAt,
      userId: asString(r.userId),
      category,
      button,
      detail: asString(r.detail),
      facetKey: asString(r.facetKey),
      facetValue: asString(r.facetValue),
    })
  }
  return rows
}
