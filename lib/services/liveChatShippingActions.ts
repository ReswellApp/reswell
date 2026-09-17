import type { SupabaseClient } from "@supabase/supabase-js"
import { findSupportReplyOrderSnapshot } from "@/lib/db/supportReplyDrafts"
import { updateLiveChatSessionRow, type LiveChatSessionRow } from "@/lib/db/liveChat"
import { insertSupportCaseEvent } from "@/lib/db/supportCases"
import {
  getAdminReplaceOrderShippingLabelOverview,
  purchaseAdminExactParcelReplacementLabelForOrder,
  quoteAdminExactParcelUpsRatesForOrder,
  type AdminExactParcel,
} from "@/lib/services/adminReplaceOrderShippingLabel"
import { voidShipEngineLabelForOrder } from "@/lib/services/voidShipEngineLabelForOrder"
import {
  liveChatActorCanMutateShipping,
  resolveLiveChatActionActor,
  type LiveChatActionActor,
} from "@/lib/services/liveChatActionPolicy"
import { csAgentOrderIsInScope } from "@/lib/utils/cs-agent-scope"
import { carrierTrackingUrl } from "@/lib/utils/carrier-tracking-url"
import type { LiveChatShippingActionType } from "@/lib/validations/liveChatActions"

export type LiveChatPendingShippingAction = {
  id: string
  type: LiveChatShippingActionType
  orderId: string
  orderNum: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
  parcel?: AdminExactParcel
  rateId?: string
  shipFromAddressId?: string
  note?: string
  summary: string
  status: "pending" | "confirmed" | "cancelled" | "failed"
  createdAt: string
  resultMessage?: string
}

function readPendingActions(session: LiveChatSessionRow): LiveChatPendingShippingAction[] {
  const raw = session.metadata?.pending_shipping_actions
  if (!Array.isArray(raw)) return []
  return raw.filter((row): row is LiveChatPendingShippingAction => {
    if (!row || typeof row !== "object") return false
    const action = row as LiveChatPendingShippingAction
    return typeof action.id === "string" && typeof action.type === "string"
  })
}

async function writePendingActions(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  actions: LiveChatPendingShippingAction[],
): Promise<LiveChatSessionRow> {
  const metadata = {
    ...session.metadata,
    pending_shipping_actions: actions.slice(-8),
  }
  await updateLiveChatSessionRow(svc, session.id, { metadata })
  return { ...session, metadata }
}

async function auditCase(
  svc: SupabaseClient,
  caseId: string | null | undefined,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!caseId) return
  try {
    await insertSupportCaseEvent(svc, {
      case_id: caseId,
      event_type: eventType,
      payload,
    })
  } catch (error) {
    console.warn("[liveChatShippingActions] audit skipped", error)
  }
}

export async function getLiveChatShippingLabelStatus(
  svc: SupabaseClient,
  scope: {
    requesterUserId: string | null
    linkedOrderId: string | null
  },
  orderQuery: string,
): Promise<Record<string, unknown>> {
  const q = orderQuery.trim().replace(/^#/, "")
  const order = q
    ? await findSupportReplyOrderSnapshot(svc, {
        ...(q.match(/^[0-9a-f-]{36}$/i) ? { id: q } : { orderNum: q }),
      })
    : scope.linkedOrderId
      ? await findSupportReplyOrderSnapshot(svc, { id: scope.linkedOrderId })
      : null

  if (!order || !csAgentOrderIsInScope(order, scope)) {
    return { found: false, reason: "No order for this customer matches that reference." }
  }

  const trackingNumber = order.trackingNumber?.trim() || null
  return {
    found: true,
    id: order.id,
    orderNum: order.orderNum,
    status: order.status,
    deliveryStatus: order.deliveryStatus,
    fulfillmentMethod: order.fulfillmentMethod,
    trackingNumber,
    trackingCarrier: order.trackingCarrier,
    trackingUrl: trackingNumber
      ? carrierTrackingUrl(trackingNumber, order.trackingCarrier)
      : null,
    canVoid: Boolean(trackingNumber) && order.status !== "refunded" && order.status !== "cancelled",
    canReplace:
      order.fulfillmentMethod === "shipping" &&
      order.status !== "refunded" &&
      order.status !== "cancelled" &&
      order.deliveryStatus !== "delivered" &&
      order.deliveryStatus !== "picked_up",
    note:
      "Never invent tracking. Void/replace require a confirmed pending action — do not claim they already happened.",
  }
}

export async function proposeLiveChatShippingAction(params: {
  svc: SupabaseClient
  session: LiveChatSessionRow
  actor: LiveChatActionActor
  type: LiveChatShippingActionType
  orderQuery: string
  parcel?: AdminExactParcel
  rateId?: string
  shipFromAddressId?: string
  note?: string
}): Promise<
  | { ok: true; action: LiveChatPendingShippingAction; session: LiveChatSessionRow }
  | { ok: false; error: string; code?: string }
> {
  const status = await getLiveChatShippingLabelStatus(
    params.svc,
    {
      requesterUserId: params.session.user_id,
      linkedOrderId: null,
    },
    params.orderQuery,
  )
  if (status.found !== true || typeof status.id !== "string") {
    return { ok: false, error: "Order not found for this customer." }
  }

  const order = await findSupportReplyOrderSnapshot(params.svc, { id: status.id })
  if (!order) return { ok: false, error: "Order not found for this customer." }
  const ownership = liveChatActorCanMutateShipping(params.actor, {
    id: order.id,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    status: order.status,
    deliveryStatus: order.deliveryStatus,
  })
  if (!ownership.ok) {
    return { ok: false, error: ownership.error, code: ownership.code }
  }

  if (params.type === "void_shipping_label" && !status.canVoid) {
    return { ok: false, error: "There is no label to void on this order." }
  }
  if (params.type === "replace_shipping_label" && !status.canReplace) {
    return { ok: false, error: "This order cannot replace a shipping label right now." }
  }
  if (params.type === "replace_shipping_label") {
    if (!params.parcel) {
      return { ok: false, error: "Replacement needs parcel dimensions and weight." }
    }
    if (params.actor.role !== "staff") {
      return {
        ok: false,
        error: "Label replacement must be confirmed by staff during admin testing.",
        code: "forbidden",
      }
    }
  }

  const action: LiveChatPendingShippingAction = {
    id: crypto.randomUUID(),
    type: params.type,
    orderId: order.id,
    orderNum: order.orderNum,
    trackingNumber: order.trackingNumber,
    trackingCarrier: order.trackingCarrier,
    parcel: params.parcel,
    rateId: params.rateId,
    shipFromAddressId: params.shipFromAddressId,
    note: params.note,
    summary:
      params.type === "void_shipping_label"
        ? `Void shipping label for order ${order.orderNum ?? order.id.slice(0, 8)}`
        : `Replace shipping label for order ${order.orderNum ?? order.id.slice(0, 8)}`,
    status: "pending",
    createdAt: new Date().toISOString(),
  }

  const existing = readPendingActions(params.session).filter((row) => row.status === "pending")
  const next = [...existing.filter((row) => row.orderId !== action.orderId), action]
  const session = await writePendingActions(params.svc, params.session, [
    ...readPendingActions(params.session).filter((row) => row.status !== "pending"),
    ...next,
  ])

  await auditCase(params.svc, session.support_case_id, "live_chat_shipping_proposed", {
    actionId: action.id,
    type: action.type,
    orderId: action.orderId,
    actorRole: params.actor.role,
  })

  return { ok: true, action, session }
}

export function listLiveChatPendingShippingActions(
  session: LiveChatSessionRow,
): LiveChatPendingShippingAction[] {
  return readPendingActions(session).filter((row) => row.status === "pending")
}

export async function decideLiveChatShippingAction(params: {
  svc: SupabaseClient
  session: LiveChatSessionRow
  actor: LiveChatActionActor
  actionId: string
  decision: "confirm" | "cancel"
  /** Staff user id used as adminUserId for ShipEngine replace. */
  staffUserId?: string | null
}): Promise<
  | { ok: true; action: LiveChatPendingShippingAction; session: LiveChatSessionRow; message: string }
  | { ok: false; error: string; code?: string }
> {
  const actions = readPendingActions(params.session)
  const index = actions.findIndex((row) => row.id === params.actionId)
  if (index < 0) return { ok: false, error: "Action not found." }
  const action = actions[index]!
  if (action.status !== "pending") {
    return { ok: false, error: "This action was already handled." }
  }

  const order = await findSupportReplyOrderSnapshot(params.svc, { id: action.orderId })
  if (!order) return { ok: false, error: "Order not found." }

  const ownership = liveChatActorCanMutateShipping(params.actor, {
    id: order.id,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    status: order.status,
    deliveryStatus: order.deliveryStatus,
  })
  if (!ownership.ok) {
    return { ok: false, error: ownership.error, code: ownership.code }
  }

  if (params.decision === "cancel") {
    const cancelled: LiveChatPendingShippingAction = {
      ...action,
      status: "cancelled",
      resultMessage: "Cancelled",
    }
    actions[index] = cancelled
    const session = await writePendingActions(params.svc, params.session, actions)
    await auditCase(params.svc, session.support_case_id, "live_chat_shipping_cancelled", {
      actionId: action.id,
      type: action.type,
      orderId: action.orderId,
    })
    return { ok: true, action: cancelled, session, message: "Cancelled." }
  }

  if (action.type === "void_shipping_label") {
    const voided = await voidShipEngineLabelForOrder({
      supabase: params.svc,
      orderId: action.orderId,
      explicitLabelId: null,
    })
    const next: LiveChatPendingShippingAction = voided.ok
      ? {
          ...action,
          status: "confirmed",
          resultMessage: voided.data.message || "Label void submitted.",
        }
      : {
          ...action,
          status: "failed",
          resultMessage: voided.error,
        }
    actions[index] = next
    const session = await writePendingActions(params.svc, params.session, actions)
    await auditCase(params.svc, session.support_case_id, "live_chat_shipping_void", {
      actionId: action.id,
      orderId: action.orderId,
      ok: voided.ok,
    })
    if (!voided.ok) return { ok: false, error: voided.error }
    return {
      ok: true,
      action: next,
      session,
      message: next.resultMessage ?? "Label void submitted.",
    }
  }

  // replace
  const staffUserId = params.staffUserId ?? (params.actor.role === "staff" ? params.actor.userId : null)
  if (!staffUserId) {
    return {
      ok: false,
      error: "Staff must confirm label replacements during admin testing.",
      code: "forbidden",
    }
  }
  if (!action.parcel) {
    return { ok: false, error: "Missing parcel dimensions for replacement." }
  }

  let rateId = action.rateId?.trim() || ""
  if (!rateId) {
    const quoted = await quoteAdminExactParcelUpsRatesForOrder({
      supabase: params.svc,
      orderId: action.orderId,
      adminUserId: staffUserId,
      parcel: action.parcel,
      shipFromAddressId: action.shipFromAddressId,
    })
    if (!quoted.ok) return { ok: false, error: quoted.error }
    const cheapest = [...quoted.data.rates].sort((a, b) => a.amount - b.amount)[0]
    if (!cheapest) return { ok: false, error: "No UPS rates available for that parcel." }
    rateId = cheapest.rate_id
  }

  const purchased = await purchaseAdminExactParcelReplacementLabelForOrder({
    supabase: params.svc,
    adminUserId: staffUserId,
    orderId: action.orderId,
    parcel: action.parcel,
    rateId,
    shipFromAddressId: action.shipFromAddressId,
  })

  const next: LiveChatPendingShippingAction = purchased.ok
    ? {
        ...action,
        status: "confirmed",
        rateId,
        resultMessage: `Replacement label ready. Tracking ${purchased.data.trackingNumber}.`,
      }
    : {
        ...action,
        status: "failed",
        resultMessage: purchased.error,
      }
  actions[index] = next
  const session = await writePendingActions(params.svc, params.session, actions)
  await auditCase(params.svc, session.support_case_id, "live_chat_shipping_replace", {
    actionId: action.id,
    orderId: action.orderId,
    ok: purchased.ok,
  })
  if (!purchased.ok) return { ok: false, error: purchased.error }
  return {
    ok: true,
    action: next,
    session,
    message: next.resultMessage ?? "Replacement label purchased.",
  }
}

export async function shippingLabelOverviewForStaff(
  svc: SupabaseClient,
  orderId: string,
  adminUserId: string,
) {
  return getAdminReplaceOrderShippingLabelOverview({
    supabase: svc,
    orderId,
    adminUserId,
  })
}

export { resolveLiveChatActionActor }
