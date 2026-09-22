import type { SupabaseClient } from "@supabase/supabase-js"
import {
  FEATURE_REQUEST_OPEN_STATUSES,
  FEATURE_REQUEST_PAGE_SIZE,
  type FeatureRequestAuthor,
  type FeatureRequestBoardQuery,
  type FeatureRequestChangelogEntry,
  type FeatureRequestCommentItem,
  type FeatureRequestKind,
  type FeatureRequestListItem,
  type FeatureRequestStatus,
  type FeatureRequestTag,
} from "@/lib/types/feature-requests"
import {
  featureRequestRange,
  isFeatureRequestKind,
  isFeatureRequestStatus,
  isFeatureRequestTag,
  parseFeatureRequestSearchNumber,
} from "@/lib/utils/feature-requests"

const REQUEST_COLUMNS =
  "id, number, kind, title, body, status, tags, estimated_label, vote_count, comment_count, created_at, author_id"

const COMMENT_LIMIT = 100

type RequestRow = {
  id: string
  number: number
  kind: string
  title: string
  body: string
  status: string
  tags: string[]
  estimated_label: string | null
  vote_count: number
  comment_count: number
  created_at: string
  author_id: string
}

type CommentRow = {
  id: string
  body: string
  created_at: string
  author_id: string
  request_id: string
}

type ProfileRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/[,"()]/g, " ")
}

function asRequestRow(value: unknown): RequestRow | null {
  if (typeof value !== "object" || value === null) return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== "string" || typeof row.author_id !== "string") return null
  if (typeof row.number !== "number" || typeof row.title !== "string" || typeof row.body !== "string") return null
  if (typeof row.kind !== "string" || typeof row.status !== "string" || typeof row.created_at !== "string") return null
  if (!isFeatureRequestKind(row.kind) || !isFeatureRequestStatus(row.status)) return null
  const tags = Array.isArray(row.tags)
    ? row.tags.filter((tag): tag is string => typeof tag === "string")
    : []
  return {
    id: row.id,
    number: row.number,
    kind: row.kind,
    title: row.title,
    body: row.body,
    status: row.status,
    tags,
    estimated_label: typeof row.estimated_label === "string" ? row.estimated_label : null,
    vote_count: typeof row.vote_count === "number" ? row.vote_count : 0,
    comment_count: typeof row.comment_count === "number" ? row.comment_count : 0,
    created_at: row.created_at,
    author_id: row.author_id,
  }
}

function toListItem(row: RequestRow, author: FeatureRequestAuthor | undefined): FeatureRequestListItem {
  const tags = row.tags.filter((tag): tag is FeatureRequestTag => isFeatureRequestTag(tag))
  return {
    id: row.id,
    number: row.number,
    kind: row.kind as FeatureRequestKind,
    title: row.title,
    body: row.body,
    status: row.status as FeatureRequestStatus,
    tags,
    estimatedLabel: row.estimated_label,
    voteCount: row.vote_count,
    commentCount: row.comment_count,
    createdAt: row.created_at,
    author: author ?? { id: row.author_id, displayName: null, avatarUrl: null },
    votedByViewer: false,
  }
}

async function fetchAuthors(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, FeatureRequestAuthor>> {
  const unique = [...new Set(ids)]
  const authors = new Map<string, FeatureRequestAuthor>()
  if (unique.length === 0) return authors

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", unique)

  if (error) {
    console.error("[feature-requests] profiles:", error.message)
    return authors
  }

  for (const row of (data ?? []) as ProfileRow[]) {
    if (typeof row.id !== "string") continue
    authors.set(row.id, {
      id: row.id,
      displayName: typeof row.display_name === "string" ? row.display_name : null,
      avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
    })
  }
  return authors
}

export async function listFeatureRequests(
  supabase: SupabaseClient,
  boardQuery: FeatureRequestBoardQuery,
): Promise<{ requests: FeatureRequestListItem[]; total: number; error: string | null }> {
  const { from, to } = featureRequestRange(boardQuery.page)
  let filtered = supabase.from("feature_requests").select(REQUEST_COLUMNS, { count: "exact" })

  if (boardQuery.status === "open") {
    filtered = filtered.in("status", [...FEATURE_REQUEST_OPEN_STATUSES])
  } else if (boardQuery.status !== "all") {
    filtered = filtered.eq("status", boardQuery.status)
  }
  if (boardQuery.kind !== "all") {
    filtered = filtered.eq("kind", boardQuery.kind)
  }
  const q = boardQuery.q.trim()
  if (q) {
    const pattern = `%${escapeIlike(q)}%`
    const number = parseFeatureRequestSearchNumber(q)
    const parts = [`title.ilike.${pattern}`, `body.ilike.${pattern}`]
    if (number != null) parts.push(`number.eq.${number}`)
    filtered = filtered.or(parts.join(","))
  }
  if (boardQuery.sort === "new") {
    filtered = filtered.order("created_at", { ascending: false })
  } else if (boardQuery.sort === "comments") {
    filtered = filtered
      .order("comment_count", { ascending: false })
      .order("created_at", { ascending: false })
  } else {
    filtered = filtered.order("vote_count", { ascending: false }).order("created_at", { ascending: false })
  }

  const { data, error, count } = await filtered.range(from, to)

  if (error) {
    console.error("[feature-requests] list:", error.message)
    return { requests: [], total: 0, error: error.message }
  }

  const rows = ((data ?? []) as unknown[]).map(asRequestRow).filter((row): row is RequestRow => row !== null)
  const authors = await fetchAuthors(supabase, rows.map((row) => row.author_id))
  return {
    requests: rows.map((row) => toListItem(row, authors.get(row.author_id))),
    total: count ?? rows.length,
    error: null,
  }
}

export async function getFeatureRequestByNumber(
  supabase: SupabaseClient,
  number: number,
): Promise<{ request: FeatureRequestListItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from("feature_requests")
    .select(REQUEST_COLUMNS)
    .eq("number", number)
    .maybeSingle()

  if (error) {
    console.error("[feature-requests] detail:", error.message)
    return { request: null, error: error.message }
  }
  const row = asRequestRow(data)
  if (!row) return { request: null, error: null }
  const authors = await fetchAuthors(supabase, [row.author_id])
  return { request: toListItem(row, authors.get(row.author_id)), error: null }
}

export async function listFeatureRequestComments(
  supabase: SupabaseClient,
  requestId: string,
): Promise<{ comments: FeatureRequestCommentItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from("feature_request_comments")
    .select("id, body, created_at, author_id, request_id")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true })
    .limit(COMMENT_LIMIT)

  if (error) {
    console.error("[feature-requests] comments:", error.message)
    return { comments: [], error: error.message }
  }

  const rows = ((data ?? []) as CommentRow[]).filter(
    (row) => typeof row.id === "string" && typeof row.body === "string" && typeof row.author_id === "string",
  )
  const authors = await fetchAuthors(supabase, rows.map((row) => row.author_id))
  return {
    comments: rows.map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      author: authors.get(row.author_id) ?? { id: row.author_id, displayName: null, avatarUrl: null },
      canDelete: false,
    })),
    error: null,
  }
}

export async function getFeatureRequestChangelogForRequest(
  supabase: SupabaseClient,
  requestId: string,
): Promise<FeatureRequestChangelogEntry | null> {
  const { data, error } = await supabase
    .from("feature_request_changelog")
    .select("id, title, body, published_at, request_id")
    .eq("request_id", requestId)
    .maybeSingle()

  if (error) {
    console.error("[feature-requests] changelog entry:", error.message)
    return null
  }
  if (!data || typeof data.id !== "string") return null
  return {
    id: data.id,
    title: typeof data.title === "string" ? data.title : "",
    body: typeof data.body === "string" ? data.body : "",
    publishedAt: typeof data.published_at === "string" ? data.published_at : "",
    requestNumber: null,
  }
}

export async function listFeatureRequestChangelog(
  supabase: SupabaseClient,
): Promise<{ entries: FeatureRequestChangelogEntry[]; error: string | null }> {
  const { data, error } = await supabase
    .from("feature_request_changelog")
    .select("id, title, body, published_at, request_id")
    .order("published_at", { ascending: false })
    .limit(100)

  if (error) {
    console.error("[feature-requests] changelog:", error.message)
    return { entries: [], error: error.message }
  }

  const rows = (data ?? []) as {
    id: string
    title: string
    body: string
    published_at: string
    request_id: string | null
  }[]
  const requestIds = rows.map((row) => row.request_id).filter((id): id is string => typeof id === "string")
  const numbers = new Map<string, number>()
  if (requestIds.length > 0) {
    const { data: requests, error: requestError } = await supabase
      .from("feature_requests")
      .select("id, number")
      .in("id", requestIds)
    if (requestError) {
      console.error("[feature-requests] changelog numbers:", requestError.message)
    } else {
      for (const request of (requests ?? []) as { id: string; number: number }[]) {
        if (typeof request.id === "string" && typeof request.number === "number") {
          numbers.set(request.id, request.number)
        }
      }
    }
  }

  return {
    entries: rows
      .filter((row) => typeof row.id === "string" && typeof row.title === "string")
      .map((row) => ({
        id: row.id,
        title: row.title,
        body: typeof row.body === "string" ? row.body : "",
        publishedAt: row.published_at,
        requestNumber: row.request_id ? (numbers.get(row.request_id) ?? null) : null,
      })),
    error: null,
  }
}

export async function listViewerFeatureRequestVotes(
  supabase: SupabaseClient,
  userId: string,
  requestIds: string[],
): Promise<Set<string>> {
  if (requestIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from("feature_request_votes")
    .select("request_id")
    .eq("user_id", userId)
    .in("request_id", requestIds)

  if (error) {
    console.error("[feature-requests] votes:", error.message)
    return new Set()
  }
  return new Set(
    ((data ?? []) as { request_id: string }[])
      .map((row) => row.request_id)
      .filter((id): id is string => typeof id === "string"),
  )
}

export async function fetchFeatureRequestStaffFlag(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", userId)
    .maybeSingle()

  if (error || !data) return false
  return data.is_admin === true || data.is_employee === true
}

export async function countRecentFeatureRequests(
  supabase: SupabaseClient,
  userId: string,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("feature_requests")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userId)
    .gte("created_at", sinceIso)

  if (error) {
    console.error("[feature-requests] post rate:", error.message)
    return 0
  }
  return count ?? 0
}

export async function countRecentFeatureRequestComments(
  supabase: SupabaseClient,
  userId: string,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("feature_request_comments")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userId)
    .gte("created_at", sinceIso)

  if (error) {
    console.error("[feature-requests] comment rate:", error.message)
    return 0
  }
  return count ?? 0
}

export { FEATURE_REQUEST_PAGE_SIZE }
