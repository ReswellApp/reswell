import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchUserRestrictionState } from "@/lib/db/accountRestrictions"
import {
  countRecentFeatureRequestComments,
  countRecentFeatureRequests,
  fetchFeatureRequestStaffFlag,
  getFeatureRequestByNumber,
  getFeatureRequestChangelogForRequest,
  listFeatureRequestChangelog,
  listFeatureRequestComments,
  listFeatureRequests,
  listViewerFeatureRequestVotes,
} from "@/lib/db/featureRequests"
import {
  ACCOUNT_BANNED_USER_MESSAGE,
  isPermanentRestrictionUntil,
} from "@/lib/messages/account-ban-errors"
import { createClient } from "@/lib/supabase/server"
import type {
  FeatureRequestBoard,
  FeatureRequestChangelogBoard,
  FeatureRequestDetail,
  FeatureRequestViewer,
} from "@/lib/types/feature-requests"
import { featureRequestPath, parseFeatureRequestBoardQuery } from "@/lib/utils/feature-requests"
import type {
  CreateFeatureRequestInput,
  FeatureRequestCommentInput,
  PublishFeatureRequestChangelogInput,
  UpdateFeatureRequestStaffInput,
} from "@/lib/validations/featureRequests"

const DAILY_POST_LIMIT = 8
const HOURLY_COMMENT_LIMIT = 30
const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

type ServiceResult<T extends object = { ok: true }> = ({ ok: true } & T) | { ok: false; error: string }

async function loadViewer(
  supabase: SupabaseClient,
  userId: string | null,
): Promise<FeatureRequestViewer> {
  if (!userId) return null
  const isStaff = await fetchFeatureRequestStaffFlag(supabase, userId)
  return { id: userId, isStaff }
}

async function postingBlockMessage(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const state = await fetchUserRestrictionState(supabase, userId)
  if (!state || state.isAdmin || state.isEmployee) return null
  if (!state.accountRestrictedUntil) return null
  const untilMs = Date.parse(state.accountRestrictedUntil)
  if (!Number.isFinite(untilMs) || untilMs <= Date.now()) return null
  if (isPermanentRestrictionUntil(state.accountRestrictedUntil)) return ACCOUNT_BANNED_USER_MESSAGE
  return "Your account is temporarily limited. You can't post on the feature board right now."
}

export async function loadFeatureRequestBoard(
  raw: Record<string, string | string[] | undefined>,
): Promise<FeatureRequestBoard> {
  const query = parseFeatureRequestBoardQuery(raw)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const [{ requests, total, error }, viewer] = await Promise.all([
    listFeatureRequests(supabase, query),
    loadViewer(supabase, user?.id ?? null),
  ])

  if (viewer && requests.length > 0) {
    const voted = await listViewerFeatureRequestVotes(
      supabase,
      viewer.id,
      requests.map((request) => request.id),
    )
    for (const request of requests) {
      request.votedByViewer = voted.has(request.id)
    }
  }

  return { query, requests, total, viewer, degraded: error != null }
}

export async function loadFeatureRequestChangelog(): Promise<FeatureRequestChangelogBoard> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const [{ entries, error }, viewer] = await Promise.all([
    listFeatureRequestChangelog(supabase),
    loadViewer(supabase, user?.id ?? null),
  ])
  return { entries, viewer, degraded: error != null }
}

export async function loadFeatureRequestDetail(
  number: number,
): Promise<{ detail: FeatureRequestDetail | null; viewer: FeatureRequestViewer; degraded: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const [{ request, error }, viewer] = await Promise.all([
    getFeatureRequestByNumber(supabase, number),
    loadViewer(supabase, user?.id ?? null),
  ])

  if (!request) return { detail: null, viewer, degraded: error != null }

  const [commentsResult, changelog, voted] = await Promise.all([
    listFeatureRequestComments(supabase, request.id),
    getFeatureRequestChangelogForRequest(supabase, request.id),
    viewer ? listViewerFeatureRequestVotes(supabase, viewer.id, [request.id]) : Promise.resolve(new Set<string>()),
  ])

  request.votedByViewer = voted.has(request.id)
  const comments = commentsResult.comments.map((comment) => ({
    ...comment,
    canDelete: viewer != null && (viewer.isStaff || viewer.id === comment.author.id),
  }))

  return {
    detail: {
      ...request,
      comments,
      commentsTruncated: request.commentCount > comments.length,
      changelog: changelog
        ? { ...changelog, requestNumber: request.number }
        : null,
    },
    viewer,
    degraded: error != null || commentsResult.error != null,
  }
}

export async function loadFeatureRequestTitle(number: number): Promise<{ title: string; body: string } | null> {
  const supabase = await createClient()
  const { request, error } = await getFeatureRequestByNumber(supabase, number)
  if (error || !request) return null
  return { title: request.title, body: request.body }
}

export async function createFeatureRequestForUser(
  supabase: SupabaseClient,
  userId: string,
  input: CreateFeatureRequestInput,
): Promise<ServiceResult<{ href: string; number: number }>> {
  const blocked = await postingBlockMessage(supabase, userId)
  if (blocked) return { ok: false, error: blocked }

  const since = new Date(Date.now() - DAY_MS).toISOString()
  const recent = await countRecentFeatureRequests(supabase, userId, since)
  if (recent >= DAILY_POST_LIMIT) {
    return { ok: false, error: "You've posted several ideas today. Try again tomorrow." }
  }

  const { data, error } = await supabase
    .from("feature_requests")
    .insert({
      author_id: userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      tags: input.tags,
      status: "idea",
    })
    .select("number")
    .single()

  if (error || typeof data?.number !== "number") {
    console.error("[feature-requests] create:", error?.message ?? "no row")
    return { ok: false, error: "Could not post that idea. Please try again." }
  }

  return { ok: true, href: featureRequestPath(data.number), number: data.number }
}

export async function toggleFeatureRequestVote(
  supabase: SupabaseClient,
  userId: string,
  requestId: string,
): Promise<ServiceResult<{ voted: boolean; voteCount: number }>> {
  const blocked = await postingBlockMessage(supabase, userId)
  if (blocked) return { ok: false, error: blocked }

  const { data: existing, error: existingError } = await supabase
    .from("feature_request_votes")
    .select("request_id")
    .eq("request_id", requestId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingError) {
    console.error("[feature-requests] vote lookup:", existingError.message)
    return { ok: false, error: "Could not update your vote. Please try again." }
  }

  if (existing) {
    const { error } = await supabase
      .from("feature_request_votes")
      .delete()
      .eq("request_id", requestId)
      .eq("user_id", userId)
    if (error) {
      console.error("[feature-requests] vote delete:", error.message)
      return { ok: false, error: "Could not update your vote. Please try again." }
    }
  } else {
    const { error } = await supabase
      .from("feature_request_votes")
      .insert({ request_id: requestId, user_id: userId })
    if (error && error.code !== "23505") {
      console.error("[feature-requests] vote insert:", error.message)
      return { ok: false, error: "Could not update your vote. Please try again." }
    }
  }

  const { data, error } = await supabase
    .from("feature_requests")
    .select("vote_count")
    .eq("id", requestId)
    .maybeSingle()

  if (error || typeof data?.vote_count !== "number") {
    console.error("[feature-requests] vote count:", error?.message ?? "missing row")
    return { ok: false, error: "Could not update your vote. Please try again." }
  }

  return { ok: true, voted: !existing, voteCount: data.vote_count }
}

export async function addFeatureRequestComment(
  supabase: SupabaseClient,
  userId: string,
  input: FeatureRequestCommentInput,
): Promise<ServiceResult<{ id: string }>> {
  const blocked = await postingBlockMessage(supabase, userId)
  if (blocked) return { ok: false, error: blocked }

  const since = new Date(Date.now() - HOUR_MS).toISOString()
  const recent = await countRecentFeatureRequestComments(supabase, userId, since)
  if (recent >= HOURLY_COMMENT_LIMIT) {
    return { ok: false, error: "You're commenting too quickly. Try again in a little while." }
  }

  const { data, error } = await supabase
    .from("feature_request_comments")
    .insert({
      request_id: input.requestId,
      author_id: userId,
      body: input.body,
    })
    .select("id")
    .single()

  if (error || typeof data?.id !== "string") {
    console.error("[feature-requests] comment:", error?.message ?? "no row")
    return { ok: false, error: "Could not post that comment. Please try again." }
  }

  return { ok: true, id: data.id }
}

export async function deleteFeatureRequestCommentForUser(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
): Promise<ServiceResult> {
  const isStaff = await fetchFeatureRequestStaffFlag(supabase, userId)
  let query = supabase.from("feature_request_comments").delete().eq("id", commentId)
  if (!isStaff) query = query.eq("author_id", userId)
  const { error } = await query
  if (error) {
    console.error("[feature-requests] delete comment:", error.message)
    return { ok: false, error: "Could not delete that comment." }
  }
  return { ok: true }
}

async function requireStaff(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const isStaff = await fetchFeatureRequestStaffFlag(supabase, userId)
  if (!isStaff) return "Only the Reswell team can update the board."
  return null
}

export async function updateFeatureRequestForStaff(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateFeatureRequestStaffInput,
): Promise<ServiceResult> {
  const denied = await requireStaff(supabase, userId)
  if (denied) return { ok: false, error: denied }

  const estimate = input.estimatedLabel?.trim() ?? ""
  const { error } = await supabase
    .from("feature_requests")
    .update({
      status: input.status,
      tags: input.tags,
      estimated_label: estimate.length > 0 ? estimate : null,
    })
    .eq("id", input.requestId)

  if (error) {
    console.error("[feature-requests] staff update:", error.message)
    return { ok: false, error: "Could not update that idea." }
  }
  return { ok: true }
}

export async function publishFeatureRequestChangelogForStaff(
  supabase: SupabaseClient,
  userId: string,
  input: PublishFeatureRequestChangelogInput,
): Promise<ServiceResult> {
  const denied = await requireStaff(supabase, userId)
  if (denied) return { ok: false, error: denied }

  const existing = await getFeatureRequestChangelogForRequest(supabase, input.requestId)
  if (existing) {
    const { error } = await supabase
      .from("feature_request_changelog")
      .update({ title: input.title, body: input.body })
      .eq("id", existing.id)
    if (error) {
      console.error("[feature-requests] changelog update:", error.message)
      return { ok: false, error: "Could not update the changelog." }
    }
  } else {
    const { error } = await supabase.from("feature_request_changelog").insert({
      request_id: input.requestId,
      title: input.title,
      body: input.body,
      created_by: userId,
    })
    if (error) {
      console.error("[feature-requests] changelog insert:", error.message)
      return { ok: false, error: "Could not publish to the changelog." }
    }
  }

  const { error: statusError } = await supabase
    .from("feature_requests")
    .update({ status: "shipped" })
    .eq("id", input.requestId)

  if (statusError) {
    console.error("[feature-requests] mark shipped:", statusError.message)
  }

  return { ok: true }
}

export async function deleteFeatureRequestForStaff(
  supabase: SupabaseClient,
  userId: string,
  requestId: string,
): Promise<ServiceResult> {
  const denied = await requireStaff(supabase, userId)
  if (denied) return { ok: false, error: denied }

  const { error } = await supabase.from("feature_requests").delete().eq("id", requestId)
  if (error) {
    console.error("[feature-requests] delete:", error.message)
    return { ok: false, error: "Could not remove that idea." }
  }
  return { ok: true }
}
