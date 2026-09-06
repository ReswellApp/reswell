import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import {
  getOrderSupportRequestById,
  updateOrderSupportRequestAdmin,
} from "@/lib/db/order-support"
import {
  getSupportCaseByOrderSupportId,
  insertSupportCaseEvent,
} from "@/lib/db/supportCases"
import { listOrderShippingLabelsForOrder } from "@/lib/db/orderShippingLabels"
import { sendOrderSupportAdminReplyService } from "@/lib/services/orderSupportThread"
import { updateProtectionCarrierClaimSchema } from "@/lib/validations/protectionClaimDesk"
import {
  CARRIER_CLAIM_STATUS_LABEL,
  SHIPENGINE_UPS_LOSS_DAMAGE_CLAIM_FORM_URL,
  type CarrierClaimStatus,
} from "@/lib/types/protectionClaimDesk"

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

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = v.trim()
  return t.length ? t : null
}

export async function updateProtectionCarrierClaimService(
  raw: unknown,
): Promise<{ success: true } | { error: string }> {
  const parsed = updateProtectionCarrierClaimSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid input" }

  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  const request = await getOrderSupportRequestById(
    staff.supabase,
    parsed.data.order_support_request_id,
  )
  if (!request) return { error: "Case not found" }
  if (request.request_type !== "refund_help") {
    return { error: "Carrier claims are only tracked on Purchase Protection cases" }
  }

  const patch: {
    carrier_claim_status?: CarrierClaimStatus | null
    carrier_claim_id?: string | null
    carrier_claim_url?: string | null
    insurance_claim_url?: string | null
  } = {}

  if (parsed.data.carrier_claim_status !== undefined) {
    patch.carrier_claim_status = parsed.data.carrier_claim_status
  }
  if (parsed.data.carrier_claim_id !== undefined) {
    patch.carrier_claim_id = emptyToNull(parsed.data.carrier_claim_id)
  }
  if (parsed.data.carrier_claim_url !== undefined) {
    patch.carrier_claim_url = emptyToNull(parsed.data.carrier_claim_url)
  }
  if (parsed.data.insurance_claim_url !== undefined) {
    patch.insurance_claim_url = emptyToNull(parsed.data.insurance_claim_url)
  }

  const { error } = await updateOrderSupportRequestAdmin(staff.supabase, {
    id: request.id,
    ...patch,
  })
  if (error) return { error: error.message }

  const service = createServiceRoleClient()
  const supportCase = await getSupportCaseByOrderSupportId(service, request.id)
  if (supportCase) {
    await insertSupportCaseEvent(service, {
      case_id: supportCase.id,
      actor_admin_id: staff.userId,
      event_type: "carrier_claim_updated",
      payload: patch,
    })
  }

  if (parsed.data.notify_customer === true && patch.carrier_claim_status) {
    const label = CARRIER_CLAIM_STATUS_LABEL[patch.carrier_claim_status]
    const reply = await sendOrderSupportAdminReplyService({
      order_support_request_id: request.id,
      body: `Update on your shipping damage claim for order ${request.order_ref}: status is now “${label}”. Reply here if you have questions.`,
    })
    if ("error" in reply) {
      console.warn("[updateProtectionCarrierClaim] notify:", reply.error)
    }
  }

  return { success: true }
}

export type ProtectionClaimShippingContext = {
  trackingNumber: string | null
  trackingCarrier: string | null
  insuranceClaimUrl: string | null
  insuranceProvider: string | null
  insuredValueAmount: number | null
  shipengineLabelId: string | null
  upsLossDamageFormUrl: string
  orderAmount: number | null
  orderStatus: string | null
}

export async function getProtectionClaimShippingContextService(
  orderSupportRequestId: string,
): Promise<
  | { success: true; context: ProtectionClaimShippingContext; caseRow: Awaited<ReturnType<typeof getOrderSupportRequestById>> }
  | { error: string }
> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  const request = await getOrderSupportRequestById(staff.supabase, orderSupportRequestId)
  if (!request) return { error: "Case not found" }

  const service = createServiceRoleClient()
  const [{ data: order }, labels] = await Promise.all([
    service
      .from("orders")
      .select("id, amount, status, tracking_number, tracking_carrier")
      .eq("id", request.order_id)
      .maybeSingle(),
    listOrderShippingLabelsForOrder(service, request.order_id),
  ])

  const latestWithInsurance =
    labels.find((l) => Boolean(l.insurance_claim_url?.trim())) ?? labels[labels.length - 1] ?? null

  const orderTrack =
    typeof order?.tracking_number === "string" ? order.tracking_number.trim() : null
  const labelTrack = latestWithInsurance?.tracking_number?.trim() || null

  return {
    success: true,
    caseRow: request,
    context: {
      trackingNumber: labelTrack || orderTrack,
      trackingCarrier:
        latestWithInsurance?.tracking_carrier?.trim() ||
        (typeof order?.tracking_carrier === "string" ? order.tracking_carrier.trim() : null),
      insuranceClaimUrl:
        request.insurance_claim_url?.trim() ||
        latestWithInsurance?.insurance_claim_url?.trim() ||
        null,
      insuranceProvider: latestWithInsurance?.insurance_provider?.trim() || null,
      insuredValueAmount:
        latestWithInsurance?.insured_value_amount != null
          ? Number(latestWithInsurance.insured_value_amount)
          : null,
      shipengineLabelId: latestWithInsurance?.shipengine_label_id?.trim() || null,
      upsLossDamageFormUrl: SHIPENGINE_UPS_LOSS_DAMAGE_CLAIM_FORM_URL,
      orderAmount: order?.amount != null ? Number(order.amount) : null,
      orderStatus: typeof order?.status === "string" ? order.status : null,
    },
  }
}
