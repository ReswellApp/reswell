"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  addFeatureRequestComment,
  createFeatureRequestForUser,
  deleteFeatureRequestCommentForUser,
  deleteFeatureRequestForStaff,
  publishFeatureRequestChangelogForStaff,
  toggleFeatureRequestVote,
  updateFeatureRequestForStaff,
} from "@/lib/services/featureRequests"
import { createClient } from "@/lib/supabase/server"
import { safeRedirectPathWithQuery } from "@/lib/auth/safe-redirect"
import { FEATURE_REQUESTS_PATH } from "@/lib/utils/feature-requests"
import {
  createFeatureRequestSchema,
  deleteFeatureRequestCommentSchema,
  deleteFeatureRequestSchema,
  featureRequestCommentSchema,
  featureRequestVoteSchema,
  publishFeatureRequestChangelogSchema,
  updateFeatureRequestStaffSchema,
} from "@/lib/validations/featureRequests"

function firstIssue(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Invalid input."
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

function revalidateBoard() {
  revalidatePath(FEATURE_REQUESTS_PATH, "layout")
}

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

export async function createFeatureRequestAction(formData: FormData): Promise<void> {
  const parsed = createFeatureRequestSchema.safeParse({
    kind: formValue(formData, "kind"),
    title: formValue(formData, "title"),
    body: formValue(formData, "body"),
    tags: formData.getAll("tags").filter((tag): tag is string => typeof tag === "string"),
  })
  if (!parsed.success) {
    redirect(`/feature-requests/new?error=${encodeURIComponent(firstIssue(parsed.error.issues))}`)
  }

  const { supabase, user } = await requireUser()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent("/feature-requests/new")}`)
  }

  const result = await createFeatureRequestForUser(supabase, user.id, parsed.data)
  if (!result.ok) {
    redirect(`/feature-requests/new?error=${encodeURIComponent(result.error)}`)
  }

  revalidateBoard()
  redirect(result.href)
}

export async function toggleFeatureRequestVoteAction(formData: FormData): Promise<void> {
  const returnTo = safeRedirectPathWithQuery(formValue(formData, "returnTo"))
  const parsed = featureRequestVoteSchema.safeParse({ requestId: formValue(formData, "requestId") })
  if (!parsed.success) {
    redirect(boardErrorPath(returnTo, firstIssue(parsed.error.issues)))
  }

  const { supabase, user } = await requireUser()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(returnTo)}`)
  }

  const result = await toggleFeatureRequestVote(supabase, user.id, parsed.data.requestId)
  if (!result.ok) {
    redirect(boardErrorPath(returnTo, result.error))
  }

  revalidateBoard()
  redirect(returnTo)
}

function boardErrorPath(returnTo: string, message: string): string {
  const separator = returnTo.includes("?") ? "&" : "?"
  return `${returnTo}${separator}error=${encodeURIComponent(message)}`
}

export async function addFeatureRequestCommentAction(raw: unknown) {
  const parsed = featureRequestCommentSchema.safeParse(raw)
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) }

  const { supabase, user } = await requireUser()
  if (!user) return { error: "Sign in to comment." }

  const result = await addFeatureRequestComment(supabase, user.id, parsed.data)
  if (!result.ok) return { error: result.error }

  revalidateBoard()
  return { success: true as const }
}

export async function deleteFeatureRequestCommentAction(raw: unknown) {
  const parsed = deleteFeatureRequestCommentSchema.safeParse(raw)
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) }

  const { supabase, user } = await requireUser()
  if (!user) return { error: "Sign in to delete a comment." }

  const result = await deleteFeatureRequestCommentForUser(supabase, user.id, parsed.data.commentId)
  if (!result.ok) return { error: result.error }

  revalidateBoard()
  return { success: true as const }
}

export async function updateFeatureRequestStaffAction(raw: unknown) {
  const parsed = updateFeatureRequestStaffSchema.safeParse(raw)
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) }

  const { supabase, user } = await requireUser()
  if (!user) return { error: "Sign in required." }

  const result = await updateFeatureRequestForStaff(supabase, user.id, parsed.data)
  if (!result.ok) return { error: result.error }

  revalidateBoard()
  return { success: true as const }
}

export async function publishFeatureRequestChangelogAction(raw: unknown) {
  const parsed = publishFeatureRequestChangelogSchema.safeParse(raw)
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) }

  const { supabase, user } = await requireUser()
  if (!user) return { error: "Sign in required." }

  const result = await publishFeatureRequestChangelogForStaff(supabase, user.id, parsed.data)
  if (!result.ok) return { error: result.error }

  revalidateBoard()
  return { success: true as const }
}

export async function deleteFeatureRequestAction(raw: unknown) {
  const parsed = deleteFeatureRequestSchema.safeParse(raw)
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) }

  const { supabase, user } = await requireUser()
  if (!user) return { error: "Sign in required." }

  const result = await deleteFeatureRequestForStaff(supabase, user.id, parsed.data.requestId)
  if (!result.ok) return { error: result.error }

  revalidateBoard()
  return { success: true as const }
}
