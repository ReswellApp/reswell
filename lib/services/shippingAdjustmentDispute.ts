import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import {
  dbGetShippingAdjustmentDispute,
  dbInsertShippingAdjustmentDispute,
  dbListDisputesForAdjustments,
  dbListShippingAdjustmentDisputes,
  dbUpdateShippingAdjustmentDispute,
  type ShippingAdjustmentDisputeRow,
} from "@/lib/db/shippingAdjustmentDisputes"
import {
  adjustmentCarrierLabel,
  inferAdjustmentCarrier,
  type AdjustmentDisputeStatus,
  type SellerAdjustmentFeeView,
} from "@/lib/shipping/adjustment-fee"
import {
  adminShippingAdjustmentDisputeSchema,
  submitShippingAdjustmentDisputeSchema,
  type SubmitShippingAdjustmentDisputeInput,
} from "@/lib/validations/shippingAdjustmentDispute"

type ChargedAdjustmentRow = {
  id: string
  adjustment_amount_usd: number | string
  wallet_debited_at: string
  actual_length: number | string | null
  actual_width: number | string | null
  actual_height: number | string | null
  actual_weight: number | string | null
  actual_service: string | null
  tracking_number: string | null
}

function finite(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function listSellerChargedAdjustmentFees(params: {
  orderId: string
  sellerId: string
  trackingCarrier?: string | null
}): Promise<SellerAdjustmentFeeView[]> {
  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch {
    return []
  }

  const { data: ownedOrder, error: ownedOrderError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", params.orderId)
    .eq("seller_id", params.sellerId)
    .maybeSingle()
  if (ownedOrderError || !ownedOrder) {
    if (ownedOrderError) console.error("[seller adjustment fees]", ownedOrderError.message)
    return []
  }

  const { data, error } = await supabase
    .from("shipengine_label_adjustments")
    .select(
      "id, adjustment_amount_usd, wallet_debited_at, actual_length, actual_width, actual_height, actual_weight, actual_service, tracking_number, order_id, charge_seller_wallet",
    )
    .eq("order_id", params.orderId)
    .eq("charge_seller_wallet", true)
    .gt("adjustment_amount_usd", 0)
    .not("wallet_debited_at", "is", null)
    .order("wallet_debited_at", { ascending: false })

  if (error) {
    console.error("[seller adjustment fees]", error.message)
    return []
  }

  const rows = (data ?? []) as ChargedAdjustmentRow[]
  const disputes = await dbListDisputesForAdjustments(
    supabase,
    rows.map((row) => row.id),
  )
  if (disputes.error) {
    console.error("[seller adjustment disputes]", disputes.error.message)
  }
  const disputeByAdjustment = new Map(
    (disputes.data ?? []).map((dispute) => [dispute.adjustment_id, dispute]),
  )

  return rows
    .filter((row) => typeof row.wallet_debited_at === "string")
    .map((row) => ({
      id: row.id,
      amountUsd: finite(row.adjustment_amount_usd) ?? 0,
      debitedAt: row.wallet_debited_at,
      lengthIn: finite(row.actual_length),
      widthIn: finite(row.actual_width),
      heightIn: finite(row.actual_height),
      weightLb: finite(row.actual_weight),
      suggestedCarrier: inferAdjustmentCarrier(row.actual_service, params.trackingCarrier),
      dispute: (() => {
        const dispute = disputeByAdjustment.get(row.id)
        if (!dispute) return null
        return {
          carrier: dispute.carrier,
          status: dispute.status,
          sellerStatement: dispute.seller_statement,
          reswellNote: dispute.reswell_note,
          carrierReference: dispute.carrier_reference,
        }
      })(),
    }))
    .filter((row) => row.amountUsd > 0)
}

export async function submitShippingAdjustmentDispute(
  raw: unknown,
): Promise<{ success: true } | { error: string }> {
  const parsed = submitShippingAdjustmentDisputeSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the dispute and try again." }
  }

  const supabaseUser = await createClient()
  const {
    data: { user },
  } = await supabaseUser.auth.getUser()
  if (!user) return { error: "Sign in required" }

  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { error: "Could not submit this dispute" }
  }

  const input: SubmitShippingAdjustmentDisputeInput = parsed.data
  const { data: adjustment, error: adjustmentError } = await service
    .from("shipengine_label_adjustments")
    .select("id, order_id, adjustment_amount_usd, charge_seller_wallet, wallet_debited_at")
    .eq("id", input.adjustmentId)
    .maybeSingle()

  if (adjustmentError || !adjustment) {
    return { error: "That adjustment fee could not be found." }
  }
  if (adjustment.charge_seller_wallet !== true || !adjustment.wallet_debited_at) {
    return { error: "Only a deducted adjustment fee can be disputed." }
  }
  if (typeof adjustment.order_id !== "string") {
    return { error: "That adjustment fee is not tied to a sale." }
  }

  const { data: order, error: orderError } = await service
    .from("orders")
    .select("id, seller_id")
    .eq("id", adjustment.order_id)
    .maybeSingle()
  if (orderError || !order || order.seller_id !== user.id) {
    return { error: "You can dispute an adjustment fee on your own sale." }
  }

  const inserted = await dbInsertShippingAdjustmentDispute(service, {
    adjustmentId: input.adjustmentId,
    orderId: adjustment.order_id,
    sellerId: user.id,
    carrier: input.carrier,
    reasonCode: input.reasonCode,
    sellerStatement: input.sellerStatement,
    claimedLengthIn: input.claimedLengthIn,
    claimedWidthIn: input.claimedWidthIn,
    claimedHeightIn: input.claimedHeightIn,
    claimedWeightLb: input.claimedWeightLb,
  })
  if (inserted.error) {
    if (/duplicate|unique/i.test(inserted.error.message)) {
      return { error: "A dispute is already open for this adjustment fee." }
    }
    console.error("[submit adjustment dispute]", inserted.error.message)
    return { error: "Could not submit this dispute" }
  }
  return { success: true }
}

export type AdminAdjustmentDisputeListItem = ShippingAdjustmentDisputeRow & {
  amountUsd: number
  orderDisplayNum: string | null
  sellerName: string | null
  carrierLabel: string
}

export async function listAdminAdjustmentDisputes(opts: {
  limit: number
  offset: number
  status?: AdjustmentDisputeStatus | "open"
}): Promise<
  { ok: true; data: AdminAdjustmentDisputeListItem[]; total: number } | { ok: false; error: string }
> {
  const service = createServiceRoleClient()
  const listed = await dbListShippingAdjustmentDisputes(service, opts)
  if (listed.error) return { ok: false, error: "Could not load adjustment disputes" }

  const orderIds = [...new Set(listed.data.map((row) => row.order_id).filter((id): id is string => Boolean(id)))]
  const sellerIds = [...new Set(listed.data.map((row) => row.seller_id))]
  const adjustmentIds = listed.data.map((row) => row.adjustment_id)

  const [ordersResult, profilesResult, adjustmentsResult] = await Promise.all([
    orderIds.length
      ? service.from("orders").select("id, order_num").in("id", orderIds)
      : Promise.resolve({ data: [], error: null }),
    sellerIds.length
      ? service.from("profiles").select("id, display_name").in("id", sellerIds)
      : Promise.resolve({ data: [], error: null }),
    adjustmentIds.length
      ? service
          .from("shipengine_label_adjustments")
          .select("id, adjustment_amount_usd")
          .in("id", adjustmentIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const orderNum = new Map<string, string | null>()
  for (const row of ordersResult.data ?? []) {
    orderNum.set(String(row.id), row.order_num == null ? null : String(row.order_num))
  }
  const sellerName = new Map<string, string | null>()
  for (const row of profilesResult.data ?? []) {
    sellerName.set(String(row.id), typeof row.display_name === "string" ? row.display_name : null)
  }
  const amount = new Map<string, number>()
  for (const row of adjustmentsResult.data ?? []) {
    amount.set(String(row.id), finite(row.adjustment_amount_usd as number | string | null) ?? 0)
  }

  return {
    ok: true,
    total: listed.total,
    data: listed.data.map((row) => ({
      ...row,
      amountUsd: amount.get(row.adjustment_id) ?? 0,
      orderDisplayNum: row.order_id ? (orderNum.get(row.order_id) ?? null) : null,
      sellerName: sellerName.get(row.seller_id) ?? null,
      carrierLabel: adjustmentCarrierLabel(row.carrier),
    })),
  }
}

export async function applyAdminAdjustmentDispute(
  raw: unknown,
  adminUserId: string,
): Promise<{ success: true } | { error: string }> {
  const parsed = adminShippingAdjustmentDisputeSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid dispute update" }
  }

  const service = createServiceRoleClient()
  const current = await dbGetShippingAdjustmentDispute(service, parsed.data.disputeId)
  if (current.error || !current.data) return { error: "Dispute not found" }
  const dispute = current.data
  const now = new Date().toISOString()

  if (parsed.data.action === "submit_to_carrier") {
    if (dispute.status !== "submitted_to_reswell" && dispute.status !== "submitted_to_carrier") {
      return { error: "This dispute is already closed." }
    }
    const updated = await dbUpdateShippingAdjustmentDispute(service, dispute.id, {
      status: "submitted_to_carrier",
      reswellNote: parsed.data.note ?? dispute.reswell_note,
      carrierReference: parsed.data.carrierReference ?? dispute.carrier_reference,
      submittedToCarrierAt: dispute.submitted_to_carrier_at ?? now,
      submittedToCarrierBy: adminUserId,
      resolvedAt: null,
    })
    if (updated.error) return { error: "Could not record the carrier submission" }
    return { success: true }
  }

  if (dispute.status === "resolved" || dispute.status === "denied") {
    return { error: "This dispute is already closed." }
  }

  const updated = await dbUpdateShippingAdjustmentDispute(service, dispute.id, {
    status: parsed.data.action === "resolve" ? "resolved" : "denied",
    reswellNote: parsed.data.note,
    carrierReference: dispute.carrier_reference,
    submittedToCarrierAt: dispute.submitted_to_carrier_at,
    submittedToCarrierBy: dispute.submitted_to_carrier_by,
    resolvedAt: now,
  })
  if (updated.error) return { error: "Could not update this dispute" }
  return { success: true }
}
