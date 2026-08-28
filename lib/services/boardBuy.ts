import {
  computeAutoOfferUsd,
  isQuotedBoardBuyStatus,
  slaDeadlineFrom,
} from "@/lib/board-buy/constants"
import {
  getBoardBuySubmissionById,
  getBoardBuySubmissionForUser,
  insertBoardBuyPhotos,
  insertBoardBuySubmission,
  listBoardBuySubmissionsAdmin,
  listBoardBuySubmissionsForUser,
  updateBoardBuySubmission,
} from "@/lib/db/boardBuy"
import {
  trackBoardBuyPaid,
  trackBoardBuyQuoteReady,
  trackBoardBuySubmitted,
} from "@/lib/klaviyo/track-board-buy"
import { applyOverdueBoardBuyAutoQuotes } from "@/lib/services/boardBuySla"
import { purchaseBoardBuyInboundLabel } from "@/lib/services/boardBuyLabel"
import { creditBoardBuyPayout } from "@/lib/services/boardBuyPayout"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type { BoardBuyAdminListItem, BoardBuySubmission } from "@/lib/types/board-buy"
import type { z } from "zod"
import type {
  boardBuyOpsQuoteSchema,
  boardBuySellerRespondSchema,
  boardBuySubmitSchema,
} from "@/lib/validations/board-buy"

type ActionOk<T> = { success: true; data: T }
type ActionErr = { error: string }
type ActionResult<T> = ActionOk<T> | ActionErr

type Authed =
  | { ok: false; error: string }
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } }

async function requireUser(): Promise<Authed> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user || isAnonymousSupabaseUser(data.user)) {
    return { ok: false, error: "Sign in to continue." }
  }
  return { ok: true, supabase, user: data.user }
}

async function requireStaff(): Promise<Authed> {
  const auth = await requireUser()
  if (!auth.ok) return auth
  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", auth.user.id)
    .maybeSingle()
  if (profile?.is_admin !== true && profile?.is_employee !== true) {
    return { ok: false, error: "Forbidden" }
  }
  return auth
}

export async function submitBoardBuyService(
  input: z.infer<typeof boardBuySubmitSchema>,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireUser()
  if (!auth.ok) return { error: auth.error }

  const now = new Date()
  try {
    const row = await insertBoardBuySubmission(auth.supabase, {
      userId: auth.user.id,
      title: input.title,
      askingPrice: input.askingPrice,
      sellerNote: input.sellerNote?.trim() || null,
      slaDeadlineAt: slaDeadlineFrom(now).toISOString(),
      shipFromName: input.shipFromName,
      shipFromPhone: input.shipFromPhone,
      shipFromLine1: input.shipFromLine1,
      shipFromLine2: input.shipFromLine2?.trim() || null,
      shipFromCity: input.shipFromCity,
      shipFromState: input.shipFromState,
      shipFromPostal: input.shipFromPostal,
      parcelLengthIn: input.parcelLengthIn ?? null,
      parcelWidthIn: input.parcelWidthIn ?? null,
      parcelHeightIn: input.parcelHeightIn ?? null,
      parcelWeightLb: input.parcelWeightLb ?? null,
    })
    await insertBoardBuyPhotos(auth.supabase, row.id, input.photoUrls)
    const created = await getBoardBuySubmissionForUser(auth.supabase, auth.user.id, row.id)
    if (created) {
      void trackBoardBuySubmitted(created).catch((err) => {
        console.error("[boardBuy] klaviyo submit", err)
      })
    }
    return { success: true, data: { id: row.id } }
  } catch (e) {
    console.error("[boardBuy] submit", e)
    return { error: "Could not submit your board. Try again." }
  }
}

export async function listMyBoardBuysService(): Promise<ActionResult<BoardBuySubmission[]>> {
  const auth = await requireUser()
  if (!auth.ok) return { error: auth.error }
  try {
    await applyOverdueBoardBuyAutoQuotes()
    const rows = await listBoardBuySubmissionsForUser(auth.supabase, auth.user.id)
    return { success: true, data: rows }
  } catch (e) {
    console.error("[boardBuy] list mine", e)
    return { error: "Could not load submissions." }
  }
}

export async function getMyBoardBuyService(
  id: string,
): Promise<ActionResult<BoardBuySubmission>> {
  const auth = await requireUser()
  if (!auth.ok) return { error: auth.error }
  try {
    await applyOverdueBoardBuyAutoQuotes()
    const row = await getBoardBuySubmissionForUser(auth.supabase, auth.user.id, id)
    if (!row) return { error: "Not found" }
    return { success: true, data: row }
  } catch (e) {
    console.error("[boardBuy] get mine", e)
    return { error: "Could not load this submission." }
  }
}

export async function sellerRespondBoardBuyService(
  input: z.infer<typeof boardBuySellerRespondSchema>,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireUser()
  if (!auth.ok) return { error: auth.error }

  try {
    await applyOverdueBoardBuyAutoQuotes()
    const row = await getBoardBuySubmissionForUser(
      auth.supabase,
      auth.user.id,
      input.submissionId,
    )
    if (!row) return { error: "Not found" }
    if (!isQuotedBoardBuyStatus(row.status)) {
      return { error: "This quote is no longer waiting on you." }
    }

    const service = createServiceRoleClient()
    const now = new Date().toISOString()
    if (input.decision === "decline") {
      await updateBoardBuySubmission(service, row.id, {
        status: "declined",
        declined_at: now,
      })
      return { success: true, data: { id: row.id } }
    }

    await updateBoardBuySubmission(service, row.id, {
      status: "accepted",
      accepted_at: now,
    })
    const accepted = await getBoardBuySubmissionById(service, row.id)
    if (accepted) {
      const label = await purchaseBoardBuyInboundLabel(accepted)
      if (!label.ok) {
        console.error("[boardBuy] label after accept", label.error)
      }
    }
    return { success: true, data: { id: row.id } }
  } catch (e) {
    console.error("[boardBuy] seller respond", e)
    return { error: "Could not save your response." }
  }
}

export async function withdrawBoardBuyService(
  submissionId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireUser()
  if (!auth.ok) return { error: auth.error }
  try {
    const row = await getBoardBuySubmissionForUser(auth.supabase, auth.user.id, submissionId)
    if (!row) return { error: "Not found" }
    if (row.status !== "submitted" && !isQuotedBoardBuyStatus(row.status)) {
      return { error: "This submission can no longer be withdrawn." }
    }
    const service = createServiceRoleClient()
    await updateBoardBuySubmission(service, row.id, { status: "withdrawn" })
    return { success: true, data: { id: row.id } }
  } catch (e) {
    console.error("[boardBuy] withdraw", e)
    return { error: "Could not withdraw." }
  }
}

export async function listAdminBoardBuysService(): Promise<
  ActionResult<BoardBuyAdminListItem[]>
> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    await applyOverdueBoardBuyAutoQuotes()
    const service = createServiceRoleClient()
    const rows = await listBoardBuySubmissionsAdmin(service)
    const userIds = [...new Set(rows.map((r) => r.userId))]
    const { data: profiles } = await service
      .from("profiles")
      .select("id, email, display_name")
      .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"])

    const byId = new Map(
      (profiles ?? []).map((p) => [
        p.id as string,
        {
          email: typeof p.email === "string" ? p.email : null,
          displayName: typeof p.display_name === "string" ? p.display_name : null,
        },
      ]),
    )

    return {
      success: true,
      data: rows.map((row) => ({
        ...row,
        sellerEmail: byId.get(row.userId)?.email ?? null,
        sellerDisplayName: byId.get(row.userId)?.displayName ?? null,
      })),
    }
  } catch (e) {
    console.error("[boardBuy] admin list", e)
    return { error: "Could not load buy-program queue." }
  }
}

export async function getAdminBoardBuyService(
  id: string,
): Promise<ActionResult<BoardBuyAdminListItem>> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    await applyOverdueBoardBuyAutoQuotes()
    const service = createServiceRoleClient()
    const row = await getBoardBuySubmissionById(service, id)
    if (!row) return { error: "Not found" }
    const { data: profile } = await service
      .from("profiles")
      .select("email, display_name")
      .eq("id", row.userId)
      .maybeSingle()
    return {
      success: true,
      data: {
        ...row,
        sellerEmail: typeof profile?.email === "string" ? profile.email : null,
        sellerDisplayName: typeof profile?.display_name === "string" ? profile.display_name : null,
      },
    }
  } catch (e) {
    console.error("[boardBuy] admin get", e)
    return { error: "Could not load submission." }
  }
}

export async function opsQuoteBoardBuyService(
  input: z.infer<typeof boardBuyOpsQuoteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  try {
    const service = createServiceRoleClient()
    const row = await getBoardBuySubmissionById(service, input.submissionId)
    if (!row) return { error: "Not found" }
    if (row.status !== "submitted") {
      return { error: "This submission is no longer waiting on ops." }
    }

    const now = new Date().toISOString()
    if (input.mode === "decline") {
      await updateBoardBuySubmission(service, row.id, {
        status: "declined",
        declined_at: now,
        quote_source: "ops",
        ops_notes: input.opsNotes?.trim() || null,
      })
      return { success: true, data: { id: row.id } }
    }

    const offered =
      input.mode === "accept_asking" ? row.askingPrice : input.offeredPrice
    if (offered == null) {
      return { error: "Enter a counter price." }
    }

    await updateBoardBuySubmission(service, row.id, {
      status: "quoted",
      quote_source: "ops",
      offered_price: offered.toFixed(2),
      quoted_at: now,
      ops_notes: input.opsNotes?.trim() || null,
    })
    const quoted = await getBoardBuySubmissionById(service, row.id)
    if (quoted) {
      void trackBoardBuyQuoteReady(quoted).catch((err) => {
        console.error("[boardBuy] klaviyo quote", err)
      })
    }
    return { success: true, data: { id: row.id } }
  } catch (e) {
    console.error("[boardBuy] ops quote", e)
    return { error: "Could not save quote." }
  }
}

export async function opsPurchaseBoardBuyLabelService(
  submissionId: string,
): Promise<ActionResult<{ id: string }>> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const service = createServiceRoleClient()
    const row = await getBoardBuySubmissionById(service, submissionId)
    if (!row) return { error: "Not found" }
    const result = await purchaseBoardBuyInboundLabel(row)
    if (!result.ok) return { error: result.error }
    return { success: true, data: { id: submissionId } }
  } catch (e) {
    console.error("[boardBuy] ops label", e)
    return { error: "Could not purchase label." }
  }
}

export async function opsMarkReceivedAndPayService(
  submissionId: string,
): Promise<ActionResult<{ id: string }>> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const service = createServiceRoleClient()
    const row = await getBoardBuySubmissionById(service, submissionId)
    if (!row) return { error: "Not found" }
    if (row.status !== "accepted" && row.status !== "label_ready" && row.status !== "received") {
      return { error: "Board is not ready to pay." }
    }
    if (row.offeredPrice == null) {
      return { error: "Missing offer price." }
    }
    if (!row.paidAt) {
      const pay = await creditBoardBuyPayout(service, {
        userId: row.userId,
        amountUsd: row.offeredPrice,
        submissionId: row.id,
        title: row.title,
      })
      if (!pay.ok) return { error: pay.error }
    }
    const now = new Date().toISOString()
    await updateBoardBuySubmission(service, row.id, {
      status: "paid",
      received_at: row.receivedAt ?? now,
      paid_at: now,
    })
    const paid = await getBoardBuySubmissionById(service, row.id)
    if (paid) {
      void trackBoardBuyPaid(paid).catch((err) => {
        console.error("[boardBuy] klaviyo paid", err)
      })
    }
    return { success: true, data: { id: row.id } }
  } catch (e) {
    console.error("[boardBuy] pay", e)
    return { error: "Could not pay seller." }
  }
}

export { computeAutoOfferUsd }
