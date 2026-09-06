import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getOrderSupportRequestById,
  type OrderSupportRequestRow,
} from "@/lib/db/order-support"
import {
  getSupportCaseByOrderSupportId,
  insertSupportCaseEvent,
  insertSupportCaseMessage,
} from "@/lib/db/supportCases"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { createClient } from "@/lib/supabase/server"
import { sendOrderSupportAdminReplyService } from "@/lib/services/orderSupportThread"
import { grantProtectionRepairCreditSchema } from "@/lib/validations/protectionClaimDesk"
import { PROTECTION_REPAIR_CREDIT_REFERENCE_TYPE } from "@/lib/types/protectionClaimDesk"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

async function requireStaff(): Promise<
  | { ok: true; userId: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { ok: false, error: "Forbidden" }
  }

  return { ok: true, userId: user.id, supabase }
}

async function creditBuyerRepair(
  service: SupabaseClient,
  opts: {
    buyerId: string
    amountUsd: number
    referenceId: string
    orderRef: string
    note?: string
    nowIso: string
  },
): Promise<{ ok: true; balanceAfter: number } | { ok: false; error: string }> {
  let { data: wallet } = await service
    .from("wallets")
    .select("*")
    .eq("user_id", opts.buyerId)
    .maybeSingle()

  if (!wallet) {
    const { data: created, error: createErr } = await service
      .from("wallets")
      .insert({ user_id: opts.buyerId })
      .select()
      .single()
    if (createErr || !created) {
      return { ok: false, error: createErr?.message ?? "Could not create wallet" }
    }
    wallet = created
  }

  const prevBalance = parseFloat(String(wallet.balance ?? 0))
  const newBalance = roundMoney(prevBalance + opts.amountUsd)
  const desc =
    opts.note?.trim() ||
    `Purchase Protection repair credit — ${opts.orderRef} ($${opts.amountUsd.toFixed(2)})`

  const { error: txErr } = await service.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: opts.buyerId,
    type: "refund",
    amount: opts.amountUsd,
    balance_after: newBalance.toFixed(2),
    description: desc.slice(0, 500),
    status: "completed",
    reference_id: opts.referenceId,
    reference_type: PROTECTION_REPAIR_CREDIT_REFERENCE_TYPE,
  })

  if (txErr) {
    const code = (txErr as { code?: string }).code
    if (code === "23505") {
      return { ok: false, error: "This credit was already applied" }
    }
    return { ok: false, error: txErr.message }
  }

  const { error: updErr } = await service
    .from("wallets")
    .update({
      balance: newBalance.toFixed(2),
      updated_at: opts.nowIso,
    })
    .eq("id", wallet.id)

  if (updErr) {
    return { ok: false, error: updErr.message }
  }

  return { ok: true, balanceAfter: newBalance }
}

export async function grantProtectionRepairCreditService(
  raw: unknown,
): Promise<
  | { success: true; amount_usd: number; balance_after: number; credit_id: string }
  | { error: string }
> {
  const parsed = grantProtectionRepairCreditSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid input" }
  }

  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  const amountUsd = roundMoney(parsed.data.amount_usd)
  if (amountUsd < 0.01) return { error: "Amount must be at least $0.01" }

  const request = await getOrderSupportRequestById(staff.supabase, parsed.data.order_support_request_id)
  if (!request) return { error: "Case not found" }
  if (request.request_type !== "refund_help") {
    return { error: "Repair credits are only for Purchase Protection claims" }
  }

  const service = createServiceRoleClient()
  const { data: order, error: orderErr } = await service
    .from("orders")
    .select("id, buyer_id, amount, status")
    .eq("id", request.order_id)
    .maybeSingle()

  if (orderErr || !order) return { error: "Order not found" }
  if (order.status === "refunded") {
    return { error: "Order is already fully refunded — repair credit is not available" }
  }

  const orderTotal = parseFloat(String(order.amount ?? 0))
  const prior = Number(request.repair_credit_total ?? 0)
  if (Number.isFinite(orderTotal) && orderTotal > 0 && prior + amountUsd > orderTotal + 0.01) {
    return {
      error: `Repair credits would exceed the order total ($${orderTotal.toFixed(2)}). Cap remaining: $${Math.max(0, orderTotal - prior).toFixed(2)}.`,
    }
  }

  const creditId = crypto.randomUUID()
  const nowIso = new Date().toISOString()
  const credited = await creditBuyerRepair(service, {
    buyerId: String(order.buyer_id),
    amountUsd,
    referenceId: creditId,
    orderRef: request.order_ref,
    note: parsed.data.note,
    nowIso,
  })

  if (!credited.ok) return { error: credited.error }

  const newTotal = roundMoney(prior + amountUsd)
  const { error: patchErr } = await service
    .from("order_support_requests")
    .update({
      repair_credit_total: newTotal,
      repair_credit_last_at: nowIso,
      outcome: parsed.data.set_outcome_partial !== false ? "partial" : request.outcome,
      updated_at: nowIso,
    })
    .eq("id", request.id)

  if (patchErr) {
    console.error("[grantProtectionRepairCredit] patch case:", patchErr.message)
  }

  const supportCase = await getSupportCaseByOrderSupportId(service, request.id)
  if (supportCase) {
    await insertSupportCaseEvent(service, {
      case_id: supportCase.id,
      actor_admin_id: staff.userId,
      event_type: "protection_repair_credit",
      payload: {
        credit_id: creditId,
        amount_usd: amountUsd,
        note: parsed.data.note ?? null,
        balance_after: credited.balanceAfter,
      },
    })
    await insertSupportCaseMessage(service, {
      case_id: supportCase.id,
      author_user_id: staff.userId,
      author_role: "system",
      body: `Reswell credited $${amountUsd.toFixed(2)} to your wallet as a Purchase Protection repair credit.`,
      is_internal: false,
    })
  }

  if (parsed.data.notify_customer !== false) {
    const msg = `We've added a $${amountUsd.toFixed(2)} Purchase Protection repair credit to your Reswell wallet for order ${request.order_ref}. You can spend it at checkout anytime.${
      parsed.data.note?.trim() ? `\n\nNote from our team: ${parsed.data.note.trim()}` : ""
    }`
    const reply = await sendOrderSupportAdminReplyService({
      order_support_request_id: request.id,
      body: msg,
    })
    if ("error" in reply) {
      console.warn("[grantProtectionRepairCredit] notify:", reply.error)
    }
  }

  return {
    success: true,
    amount_usd: amountUsd,
    balance_after: credited.balanceAfter,
    credit_id: creditId,
  }
}

export type { OrderSupportRequestRow }
