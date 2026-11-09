import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchReswellCreditWalletForUser,
  rpcFinalizeReswellCreditHold,
  rpcHoldReswellCreditForPaymentIntent,
  rpcReleaseReswellCreditHold,
} from "@/lib/db/reswellCredit"
import {
  computeMaxReswellCreditApplyCents,
  creditCentsToUsd,
} from "@/lib/reswell-credit-rates"
import { isReswellCreditPilotUser } from "@/lib/services/reswellCreditPilot"
import { createServiceRoleClient } from "@/lib/supabase/server"

export function resolveReswellCreditApplyCents(params: {
  apply: boolean
  itemSubtotalUsd: number
  shippingUsd: number
  promoDiscountUsd: number
  availableCreditCents: number
}): number {
  if (!params.apply) return 0
  return computeMaxReswellCreditApplyCents({
    itemSubtotalUsd: params.itemSubtotalUsd,
    shippingUsd: params.shippingUsd,
    promoDiscountUsd: params.promoDiscountUsd,
    availableCreditCents: params.availableCreditCents,
  })
}

export async function resolveAdminReswellCreditForPaymentIntent(params: {
  supabase: SupabaseClient
  userId: string
  apply: boolean
  itemSubtotalUsd: number
  shippingUsd: number
  promoDiscountUsd: number
}): Promise<{ creditCents: number; creditUsd: number } | { error: string; status: number }> {
  if (!params.apply) return { creditCents: 0, creditUsd: 0 }

  const allowed = await isReswellCreditPilotUser(params.supabase, params.userId)
  if (!allowed) {
    return { error: "Reswell Credit checkout is limited to Reswell admins.", status: 403 }
  }

  const wallet = await fetchReswellCreditWalletForUser(params.supabase, params.userId)
  const available = wallet?.balance_cents ?? 0
  const creditCents = resolveReswellCreditApplyCents({
    apply: true,
    itemSubtotalUsd: params.itemSubtotalUsd,
    shippingUsd: params.shippingUsd,
    promoDiscountUsd: params.promoDiscountUsd,
    availableCreditCents: available,
  })

  return { creditCents, creditUsd: creditCentsToUsd(creditCents) }
}

export async function holdReswellCreditAfterPaymentIntentCreated(params: {
  userId: string
  paymentIntentId: string
  creditCents: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (params.creditCents <= 0) return { ok: true }
  try {
    const service = createServiceRoleClient()
    await rpcHoldReswellCreditForPaymentIntent(service, {
      userId: params.userId,
      amountCents: params.creditCents,
      paymentIntentId: params.paymentIntentId,
    })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[reswell-credit] hold", message)
    if (message.includes("insufficient_credit")) {
      return { ok: false, error: "Not enough Reswell Credit for this checkout." }
    }
    return { ok: false, error: "Could not apply Reswell Credit." }
  }
}

export async function releaseReswellCreditHoldForPaymentIntent(
  paymentIntentId: string,
): Promise<void> {
  const id = paymentIntentId.trim()
  if (!id) return
  try {
    const service = createServiceRoleClient()
    await rpcReleaseReswellCreditHold(service, id)
  } catch (e) {
    console.error("[reswell-credit] release hold", e)
  }
}

export async function finalizeReswellCreditHoldForOrder(params: {
  paymentIntentId: string
  orderId: string
  expectedCreditCents: number
}): Promise<{ ok: true; amountCents: number } | { ok: false; error: string }> {
  if (params.expectedCreditCents <= 0) return { ok: true, amountCents: 0 }
  try {
    const service = createServiceRoleClient()
    const result = await rpcFinalizeReswellCreditHold(service, {
      paymentIntentId: params.paymentIntentId,
      orderId: params.orderId,
    })
    const amount = result.amount_cents ?? 0
    if (Math.abs(amount - params.expectedCreditCents) > 1) {
      return { ok: false, error: "Reswell Credit hold amount mismatch" }
    }
    return { ok: true, amountCents: amount }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[reswell-credit] finalize", message)
    return { ok: false, error: "Could not finalize Reswell Credit" }
  }
}
