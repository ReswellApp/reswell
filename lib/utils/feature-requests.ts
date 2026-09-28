import {
  FEATURE_REQUEST_KIND_FILTERS,
  FEATURE_REQUEST_PAGE_SIZE,
  FEATURE_REQUEST_SORTS,
  FEATURE_REQUEST_STATUSES,
  FEATURE_REQUEST_STATUS_FILTERS,
  FEATURE_REQUEST_TAGS,
  type FeatureRequestBoardQuery,
  type FeatureRequestKind,
  type FeatureRequestKindFilter,
  type FeatureRequestSort,
  type FeatureRequestStatus,
  type FeatureRequestStatusFilter,
  type FeatureRequestTag,
} from "../types/feature-requests.ts"

export const FEATURE_REQUESTS_PATH = "/feature-requests"
export const FEATURE_REQUEST_CHANGELOG_PATH = "/feature-requests/changelog"

export const FEATURE_REQUEST_STATUS_LABEL: Record<FeatureRequestStatus, string> = {
  idea: "Idea",
  under_review: "Under Review",
  planned: "Planned",
  in_progress: "In Progress",
  shipped: "Shipped",
  closed: "Closed",
}

export const FEATURE_REQUEST_STATUS_FILTER_LABEL: Record<FeatureRequestStatusFilter, string> = {
  open: "Open",
  all: "All",
  ...FEATURE_REQUEST_STATUS_LABEL,
}

export const FEATURE_REQUEST_SORT_LABEL: Record<FeatureRequestSort, string> = {
  top: "Top votes",
  new: "Newest",
  comments: "Most comments",
}

export const FEATURE_REQUEST_KIND_FILTER_LABEL: Record<FeatureRequestKindFilter, string> = {
  all: "All",
  feature: "Ideas",
  bug: "Bugs",
}

export const FEATURE_REQUEST_TAG_LABEL: Record<FeatureRequestTag, string> = {
  buying: "Buying",
  selling: "Selling",
  app: "App",
  web: "Web",
  offers: "Offers",
  shipping: "Shipping",
  search: "Search",
}

const STATUS_FILTER_SET = new Set<string>(FEATURE_REQUEST_STATUS_FILTERS)
const SORT_SET = new Set<string>(FEATURE_REQUEST_SORTS)
const KIND_FILTER_SET = new Set<string>(FEATURE_REQUEST_KIND_FILTERS)
const STATUS_SET = new Set<string>(FEATURE_REQUEST_STATUSES)
const KIND_SET = new Set<string>(["feature", "bug"])
const TAG_SET = new Set<string>(FEATURE_REQUEST_TAGS)

function firstQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

export function parseFeatureRequestBoardQuery(
  raw: Record<string, string | string[] | undefined>,
): FeatureRequestBoardQuery {
  const statusRaw = firstQueryValue(raw.status)
  const sortRaw = firstQueryValue(raw.sort)
  const kindRaw = firstQueryValue(raw.kind)
  const pageRaw = Number(firstQueryValue(raw.page))
  const q = firstQueryValue(raw.q).trim().slice(0, 120)

  return {
    status: STATUS_FILTER_SET.has(statusRaw) ? (statusRaw as FeatureRequestStatusFilter) : "open",
    sort: SORT_SET.has(sortRaw) ? (sortRaw as FeatureRequestSort) : "top",
    kind: KIND_FILTER_SET.has(kindRaw) ? (kindRaw as FeatureRequestKindFilter) : "all",
    q,
    page: Number.isInteger(pageRaw) && pageRaw > 0 && pageRaw < 10_000 ? pageRaw : 1,
  }
}

export function featureRequestBoardHref(
  query: Partial<FeatureRequestBoardQuery> = {},
): string {
  const status = query.status ?? "open"
  const sort = query.sort ?? "top"
  const kind = query.kind ?? "all"
  const q = query.q?.trim() ?? ""
  const page = query.page ?? 1
  const params = new URLSearchParams()
  if (status !== "open") params.set("status", status)
  if (sort !== "top") params.set("sort", sort)
  if (kind !== "all") params.set("kind", kind)
  if (q) params.set("q", q)
  if (page > 1) params.set("page", String(page))
  const search = params.toString()
  return search ? `${FEATURE_REQUESTS_PATH}?${search}` : FEATURE_REQUESTS_PATH
}

export function featureRequestPath(number: number): string {
  return `${FEATURE_REQUESTS_PATH}/fr-${number}`
}

export function featureRequestCode(number: number): string {
  return `FR-${number}`
}

export function parseFeatureRequestNumberParam(raw: string): number | null {
  const match = raw.trim().match(/^(?:fr-)?(\d+)$/i)
  if (!match) return null
  const number = Number(match[1])
  if (!Number.isInteger(number) || number < 1 || number > 1_000_000) return null
  return number
}

export function parseFeatureRequestSearchNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^(?:fr-)?\d+$/i.test(trimmed)) return null
  return parseFeatureRequestNumberParam(trimmed)
}

export function isFeatureRequestStatus(value: string): value is FeatureRequestStatus {
  return STATUS_SET.has(value)
}

export function isFeatureRequestKind(value: string): value is FeatureRequestKind {
  return KIND_SET.has(value)
}

export function isFeatureRequestTag(value: string): value is FeatureRequestTag {
  return TAG_SET.has(value)
}

export function featureRequestExcerpt(body: string, max = 180): string {
  const flat = body.replace(/\s+/g, " ").trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, max - 1).trimEnd()}…`
}

export function featureRequestAuthorLabel(displayName: string | null | undefined): string {
  const name = displayName?.trim() || "Member"
  if (name === "Member") return name
  if (/\s/.test(name) || name.startsWith("@")) return name
  return `@${name}`
}

export function featureRequestCommentLabel(count: number): string {
  const safe = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  return safe === 1 ? "1 comment" : `${safe} comments`
}

export function formatFeatureRequestEstimate(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? ""
  if (!trimmed) return null
  if (/^est\.?\s/i.test(trimmed)) return trimmed.replace(/^est\.?\s*/i, "Est. ")
  return `Est. ${trimmed}`
}

export function formatFeatureRequestDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(date)
}

export function featureRequestRange(page: number): { from: number; to: number } {
  const safePage = page > 0 ? page : 1
  const from = (safePage - 1) * FEATURE_REQUEST_PAGE_SIZE
  return { from, to: from + FEATURE_REQUEST_PAGE_SIZE - 1 }
}
