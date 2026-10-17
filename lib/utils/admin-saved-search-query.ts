import { PEER_LISTING_SECTIONS, type PeerListingSection } from "@/lib/peer-listing-sections"
import { isUuidString } from "@/lib/utils/isUuid"

export const ADMIN_SAVED_SEARCH_PAGE_SIZE = 40

export const ADMIN_SAVED_SEARCH_KINDS = ["all", "alerts", "saved"] as const

export type AdminSavedSearchKind = (typeof ADMIN_SAVED_SEARCH_KINDS)[number]

export type AdminSavedSearchSectionFilter = "all" | "any" | PeerListingSection

export interface AdminSavedSearchFilters {
  query: string
  page: number
  kind: AdminSavedSearchKind
  section: AdminSavedSearchSectionFilter
}

const SECTION_SET = new Set<string>(PEER_LISTING_SECTIONS)

/** Strip characters that would break a PostgREST `or` filter. */
export function sanitizeAdminSavedSearchQuery(raw: string | undefined): string {
  return (raw ?? "")
    .replace(/[%_\\,()"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
}

export function parseAdminSavedSearchFilters(input: {
  q?: string
  page?: string
  kind?: string
  section?: string
}): AdminSavedSearchFilters {
  const page = Number.parseInt(input.page ?? "", 10)
  const kind = ADMIN_SAVED_SEARCH_KINDS.find((value) => value === input.kind) ?? "all"
  const sectionRaw = input.section?.trim() ?? "all"
  const section: AdminSavedSearchSectionFilter =
    sectionRaw === "all" || sectionRaw === "any" || SECTION_SET.has(sectionRaw)
      ? (sectionRaw as AdminSavedSearchSectionFilter)
      : "all"

  return {
    query: sanitizeAdminSavedSearchQuery(input.q),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    kind,
    section,
  }
}

/**
 * OR filter across label, criteria text, and matching account ids.
 * Values are quoted so emails and dots survive PostgREST parsing.
 */
export function buildAdminSavedSearchOrFilter(
  query: string,
  userIds: readonly string[],
): string | null {
  const term = sanitizeAdminSavedSearchQuery(query)
  const ids = userIds.filter((id) => isUuidString(id))
  if (!term && ids.length === 0) return null

  const clauses: string[] = []
  if (term) {
    const pattern = `"%${term.replace(/ /g, "%")}%"`
    for (const column of [
      "label",
      "criteria->>q",
      "criteria->>brand",
      "criteria->>model",
      "criteria->>brandSlug",
      "criteria->>modelSlug",
    ]) {
      clauses.push(`${column}.ilike.${pattern}`)
    }
  }
  if (ids.length > 0) {
    clauses.push(`user_id.in.(${ids.join(",")})`)
  }
  return clauses.join(",")
}
