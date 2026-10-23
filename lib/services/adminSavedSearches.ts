import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  adminSavedSearchListFilters,
  countAdminSavedSearchAccounts,
  countAdminSavedSearchAlertsSent,
  countAdminSavedSearches,
  findAdminSavedSearchProfileIds,
  listAdminSavedSearchProfiles,
  listAdminSavedSearchRows,
  type AdminSavedSearchDbRow,
  type AdminSavedSearchProfileRow,
} from "@/lib/db/adminSavedSearches"
import {
  PEER_LISTING_SECTION_LABELS,
  isPeerListingSection,
} from "@/lib/peer-listing-sections"
import type { AdminSavedSearchPage, AdminSavedSearchRow } from "@/lib/types/admin-saved-searches"
import {
  ADMIN_SAVED_SEARCH_PAGE_SIZE,
  type AdminSavedSearchFilters,
} from "@/lib/utils/admin-saved-search-query"
import { boardSavedSearchCriteriaSummary, boardSavedSearchCriteriaToBrowseHref } from "@/lib/utils/board-saved-search-browse-url"
import { inferSavedSearchAlertKind } from "@/lib/utils/saved-search-alert-kind"
import { boardSavedSearchCriteriaSchema, type BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

const ALERT_KIND_LABELS = {
  search: "Search",
  model: "Model",
  brand: "Brand",
} as const

function logFailure(context: string, error: Error): void {
  console.error("[admin saved searches]", context, error.message)
}

function sectionLabel(section: string | null): string {
  if (!section) return "Any section"
  if (isPeerListingSection(section)) return PEER_LISTING_SECTION_LABELS[section]
  return section
}

function criteriaPayload(raw: unknown): BoardSavedSearchCriteria {
  const parsed = boardSavedSearchCriteriaSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : {}
}

function criteriaJson(raw: unknown): string {
  try {
    return JSON.stringify(raw ?? {}, null, 2)
  } catch {
    return "{}"
  }
}

function mapRow(
  row: AdminSavedSearchDbRow,
  profiles: Map<string, AdminSavedSearchProfileRow>,
  alertCounts: Map<string, number>,
): AdminSavedSearchRow {
  const criteria = criteriaPayload(row.criteria)
  const profile = profiles.get(row.user_id)
  return {
    id: row.id,
    label: row.label?.trim() || null,
    summary: boardSavedSearchCriteriaSummary(criteria),
    criteriaJson: criteriaJson(row.criteria),
    sectionLabel: sectionLabel(row.section),
    alertKindLabel: ALERT_KIND_LABELS[inferSavedSearchAlertKind(criteria)],
    sourceLabel: criteria.source === "board-finder" ? "Board finder" : "Browse",
    emailEnabled: row.email_notifications_enabled,
    browseHref: boardSavedSearchCriteriaToBrowseHref(criteria),
    alertsSent: alertCounts.get(row.id) ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    account: {
      id: row.user_id,
      email: profile?.email ?? null,
      displayName: profile?.display_name?.trim() || null,
    },
  }
}

export async function getAdminSavedSearchesPage(
  filters: AdminSavedSearchFilters,
): Promise<AdminSavedSearchPage> {
  const supabase = createServiceRoleClient()
  const emptyStats = {
    total: 0,
    alerts: 0,
    savedOnly: 0,
    uniqueAccounts: 0,
    uniqueAccountsCapped: false,
  }

  let userIds: string[] = []
  let userMatchTruncated = false
  if (filters.query) {
    const matched = await findAdminSavedSearchProfileIds(supabase, filters.query)
    if (matched.error) {
      logFailure("profile search", matched.error)
      throw new Error("Could not load saved searches.")
    }
    userIds = matched.ids
    userMatchTruncated = matched.truncated
  }

  const listFilters = adminSavedSearchListFilters({
    query: filters.query,
    kind: filters.kind,
    section: filters.section,
    userIds,
  })
  const from = (filters.page - 1) * ADMIN_SAVED_SEARCH_PAGE_SIZE
  const to = from + ADMIN_SAVED_SEARCH_PAGE_SIZE - 1

  const [listed, totalCount, alertCount, savedCount, accounts] = await Promise.all([
    listAdminSavedSearchRows(supabase, { ...listFilters, from, to }),
    countAdminSavedSearches(supabase, { kind: "all", section: "all", orFilter: null }),
    countAdminSavedSearches(supabase, { kind: "alerts", section: "all", orFilter: null }),
    countAdminSavedSearches(supabase, { kind: "saved", section: "all", orFilter: null }),
    countAdminSavedSearchAccounts(supabase),
  ])

  const failure =
    listed.error ?? totalCount.error ?? alertCount.error ?? savedCount.error ?? accounts.error
  if (failure) {
    logFailure("list", failure)
    throw new Error("Could not load saved searches.")
  }

  const userIdSet = [...new Set(listed.rows.map((row) => row.user_id))]
  const [profilesResult, alertsSent] = await Promise.all([
    listAdminSavedSearchProfiles(supabase, userIdSet),
    countAdminSavedSearchAlertsSent(
      supabase,
      listed.rows.map((row) => row.id),
    ),
  ])
  if (profilesResult.error) {
    logFailure("profiles", profilesResult.error)
    throw new Error("Could not load saved searches.")
  }
  if (alertsSent.error) {
    logFailure("alert counts", alertsSent.error)
    throw new Error("Could not load saved searches.")
  }

  const profiles = new Map(profilesResult.profiles.map((profile) => [profile.id, profile]))

  return {
    rows: listed.rows.map((row) => mapRow(row, profiles, alertsSent.counts)),
    page: filters.page,
    pageSize: ADMIN_SAVED_SEARCH_PAGE_SIZE,
    total: listed.total,
    query: filters.query,
    kind: filters.kind,
    section: filters.section,
    userMatchTruncated,
    stats: {
      ...emptyStats,
      total: totalCount.count,
      alerts: alertCount.count,
      savedOnly: savedCount.count,
      uniqueAccounts: accounts.count,
      uniqueAccountsCapped: accounts.capped,
    },
  }
}
