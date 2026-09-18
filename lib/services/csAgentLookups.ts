import type { SupabaseClient } from "@supabase/supabase-js"
import {
  findHelpArticlesBySlugs,
} from "@/lib/help-center/plain-text"
import {
  findSupportReplyOrderSnapshot,
  getSupportReplyRepairCreditTotal,
  listSupportReplyOrdersForCustomer,
  type SupportReplyOrderSnapshot,
} from "@/lib/db/supportReplyDrafts"
import {
  listSupportCasesByRequesterEmail,
  listSupportCasesForRequester,
  type SupportCaseRow,
} from "@/lib/db/supportCases"
import type { LiveChatSessionRow } from "@/lib/db/liveChat"
import { listRecentLiveChatAiListingsForMember } from "@/lib/db/liveChatAiListings"
import { retrieveHelpArticlesForQuery } from "@/lib/services/supportReplyKnowledge"
import {
  getLiveChatShippingLabelStatus,
  proposeLiveChatShippingAction,
} from "@/lib/services/liveChatShippingActions"
import type { LiveChatActionActor } from "@/lib/services/liveChatActionPolicy"
import { assessCsAgentRefundEligibility } from "@/lib/utils/cs-agent-refund"
import { csAgentEmailsMatch, csAgentOrderIsInScope } from "@/lib/utils/cs-agent-scope"
import { carrierTrackingUrl } from "@/lib/utils/carrier-tracking-url"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"
import type { CsAgentAccountSnapshot, CsAgentPriorTicket } from "@/lib/llm/cs-agent"
import type { CsAgentToolLookups } from "@/lib/llm/cs-agent-generate"

export type CsAgentLookupSession = {
  lookups: CsAgentToolLookups
  resolvedOrders: () => SupportReplyOrderSnapshot[]
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CsAgentLookupScope = {
  caseId: string
  requesterUserId: string | null
  requesterEmail: string | null
  linkedOrderId: string | null
}

export type CsAgentLookupOptions = {
  /** When set, the agent may propose confirm-gated shipping mutations on this session. */
  liveChatSession?: LiveChatSessionRow
  liveChatActor?: LiveChatActionActor
}

function normalizeOrderQuery(raw: string): string {
  return raw.trim().replace(/^#/, "")
}

function compactOrder(order: SupportReplyOrderSnapshot) {
  return {
    found: true as const,
    id: order.id,
    orderNum: order.orderNum,
    status: order.status,
    amount: order.amount,
    fulfillmentMethod: order.fulfillmentMethod,
    deliveryStatus: order.deliveryStatus,
    trackingNumber: order.trackingNumber,
    trackingCarrier: order.trackingCarrier,
    carrierDeliveredAt: order.carrierDeliveredAt,
    paymentMethod: order.paymentMethod,
  }
}

function ticketView(row: SupportCaseRow): CsAgentPriorTicket {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    kind: row.kind,
    orderRef: row.order_ref,
    updatedAt: row.updated_at,
  }
}

export async function listPriorTicketsForCsAgent(
  service: SupabaseClient,
  scope: CsAgentLookupScope,
  limit = 8,
): Promise<CsAgentPriorTicket[]> {
  const [byUser, byEmailRaw] = await Promise.all([
    scope.requesterUserId
      ? listSupportCasesForRequester(service, scope.requesterUserId, "all")
      : Promise.resolve([] as SupportCaseRow[]),
    scope.requesterEmail
      ? listSupportCasesByRequesterEmail(service, scope.requesterEmail, { limit: 12 })
      : Promise.resolve([] as SupportCaseRow[]),
  ])
  const byEmail = byEmailRaw.filter((row) =>
    csAgentEmailsMatch(row.requester_email, scope.requesterEmail),
  )
  const seen = new Set<string>()
  const merged: CsAgentPriorTicket[] = []
  for (const row of [...byUser, ...byEmail]) {
    if (row.id === scope.caseId || seen.has(row.id)) continue
    seen.add(row.id)
    merged.push(ticketView(row))
    if (merged.length >= limit) break
  }
  return merged
}

function accountOrderRole(
  order: SupportReplyOrderSnapshot,
  userId: string,
): "purchase" | "sale" | "both" {
  const buyer = order.buyerId === userId
  const seller = order.sellerId === userId
  if (buyer && seller) return "both"
  if (seller) return "sale"
  return "purchase"
}

/** Recent orders and listings for this signed-in visitor. Empty when they are a guest. */
export async function loadLiveChatAccountSnapshot(
  service: SupabaseClient,
  userId: string | null,
): Promise<CsAgentAccountSnapshot> {
  if (!userId) return { signedIn: false, orders: [], listings: [] }

  try {
    const [orders, listings] = await Promise.all([
      listSupportReplyOrdersForCustomer(service, userId, 8),
      listRecentLiveChatAiListingsForMember(service, userId, 6),
    ])
    return {
      signedIn: true,
      orders: orders.map((order) => ({
        id: order.id,
        orderNum: order.orderNum,
        role: accountOrderRole(order, userId),
        status: order.status,
        amount: order.amount,
        fulfillmentMethod: order.fulfillmentMethod,
        deliveryStatus: order.deliveryStatus,
        trackingNumber: order.trackingNumber,
        trackingCarrier: order.trackingCarrier,
      })),
      listings: listings.map((listing) => ({
        title: listing.title,
        status: listing.status,
        price: listing.price,
        href: listing.listing_href,
      })),
    }
  } catch (error) {
    console.warn(
      "[csAgentLookups] live chat snapshot skipped:",
      error instanceof Error ? error.message : error,
    )
    return { signedIn: true, orders: [], listings: [] }
  }
}

async function resolveScopedOrder(
  service: SupabaseClient,
  scope: CsAgentLookupScope,
  query: string,
): Promise<SupportReplyOrderSnapshot | null> {
  const q = normalizeOrderQuery(query)
  if (!q && scope.linkedOrderId) {
    return findSupportReplyOrderSnapshot(service, { id: scope.linkedOrderId })
  }
  if (!q) return null

  if (UUID_RE.test(q)) {
    const byId = await findSupportReplyOrderSnapshot(service, { id: q })
    if (byId && csAgentOrderIsInScope(byId, scope)) return byId
    return null
  }

  const byNum = await findSupportReplyOrderSnapshot(service, { orderNum: q })
  if (byNum && csAgentOrderIsInScope(byNum, scope)) return byNum

  const tracking = normalizeTrackingNumberForCarrier(q)
  if (tracking && scope.requesterUserId) {
    const customerOrders = await listSupportReplyOrdersForCustomer(service, scope.requesterUserId, 40)
    return (
      customerOrders.find((order) => {
        const tn = order.trackingNumber
        return tn && normalizeTrackingNumberForCarrier(tn) === tracking
      }) ?? null
    )
  }

  if (tracking && scope.linkedOrderId) {
    const linked = await findSupportReplyOrderSnapshot(service, { id: scope.linkedOrderId })
    if (linked?.trackingNumber && normalizeTrackingNumberForCarrier(linked.trackingNumber) === tracking) {
      return linked
    }
  }

  return null
}

export function createCsAgentLookups(
  service: SupabaseClient,
  scope: CsAgentLookupScope,
  options?: CsAgentLookupOptions,
): CsAgentLookupSession {
  const resolved: SupportReplyOrderSnapshot[] = []
  const remember = (order: SupportReplyOrderSnapshot) => {
    if (!resolved.some((row) => row.id === order.id)) resolved.push(order)
  }

  const lookups: CsAgentToolLookups = {
      confirmAuth: async () => {
        const signedIn = Boolean(scope.requesterUserId)
        return {
          signedIn,
          userId: scope.requesterUserId,
          emailOnFile: Boolean(scope.requesterEmail?.trim()),
          canAccessOrders: signedIn,
          note: signedIn
            ? "Signed in. Only share orders where this user is buyer or seller."
            : "Not signed in. Ask them to sign in before discussing orders, purchases, or sales. Do not invent account data.",
        }
      },
      listCustomerOrders: async (query) => {
        if (!scope.requesterUserId) {
          return {
            authRequired: true,
            orders: [],
            note: "Visitor is not signed in. Ask them to sign in first.",
          }
        }
        const all = await listSupportReplyOrdersForCustomer(service, scope.requesterUserId, 20)
        const filter = query?.trim().toLowerCase() ?? "all"
        const mapped = all.map((order) => {
          const role =
            order.buyerId === scope.requesterUserId
              ? order.sellerId === scope.requesterUserId
                ? "both"
                : "purchase"
              : "sale"
          remember(order)
          return {
            ...compactOrder(order),
            role,
          }
        })
        const orders =
          filter === "purchases" || filter === "purchase" || filter === "buying"
            ? mapped.filter((row) => row.role === "purchase" || row.role === "both")
            : filter === "sales" || filter === "sale" || filter === "selling"
              ? mapped.filter((row) => row.role === "sale" || row.role === "both")
              : mapped
        return {
          authRequired: false,
          count: orders.length,
          orders,
          note: "Read-only. Never expose another customer's orders.",
        }
      },
      lookupOrder: async (query) => {
        const order = await resolveScopedOrder(service, scope, query)
        if (!order) {
          return { found: false, reason: "No order for this customer matches that reference." }
        }
        remember(order)
        return compactOrder(order)
      },
      lookupTracking: async (query) => {
        const order = await resolveScopedOrder(service, scope, query)
        if (!order) {
          return { found: false, reason: "No order for this customer matches that reference." }
        }
        remember(order)
        const trackingNumber = order.trackingNumber?.trim() || null
        return {
          found: true,
          id: order.id,
          orderNum: order.orderNum,
          status: order.status,
          deliveryStatus: order.deliveryStatus,
          trackingNumber,
          trackingCarrier: order.trackingCarrier,
          carrierDeliveredAt: order.carrierDeliveredAt,
          trackingUrl:
            trackingNumber ? carrierTrackingUrl(trackingNumber, order.trackingCarrier) : null,
          note: trackingNumber
            ? "Use only this tracking number. Do not invent another."
            : "No tracking number is on file. Do not invent one.",
        }
      },
      refundEligibility: async (query) => {
        const order = await resolveScopedOrder(service, scope, query)
        if (!order) {
          return { found: false, reason: "No order for this customer matches that reference." }
        }
        remember(order)
        const repairCreditTotal = await getSupportReplyRepairCreditTotal(service, order.id)
        const assessment = assessCsAgentRefundEligibility({
          status: order.status,
          amount: order.amount,
          paymentMethod: order.paymentMethod,
          fulfillmentMethod: order.fulfillmentMethod,
          deliveryStatus: order.deliveryStatus,
          repairCreditTotal,
        })
        return {
          found: true,
          id: order.id,
          orderNum: order.orderNum,
          repairCreditTotal,
          ...assessment,
        }
      },
      helpArticle: async (query) => {
        const q = query.trim()
        if (!q) return { articles: [] }
        const bySlug = findHelpArticlesBySlugs([q])
        const ranked = bySlug.length > 0 ? bySlug : retrieveHelpArticlesForQuery(q, 3)
        return {
          articles: ranked.slice(0, 3).map((article) => ({
            slug: article.slug,
            title: article.title,
            href: article.href,
            description: article.description,
            excerpt: article.body.slice(0, 1200),
          })),
        }
      },
      priorTickets: async (query) => {
        const tickets = await listPriorTicketsForCsAgent(service, scope, 8)
        const q = query?.trim().toLowerCase()
        const filtered = q
          ? tickets.filter(
              (ticket) =>
                ticket.subject.toLowerCase().includes(q) ||
                ticket.kind.toLowerCase().includes(q) ||
                (ticket.orderRef?.toLowerCase().includes(q) ?? false),
            )
          : tickets
        return { tickets: filtered }
      },
      shippingLabelStatus: async (query) => {
        const result = await getLiveChatShippingLabelStatus(
          service,
          {
            requesterUserId: scope.requesterUserId,
            linkedOrderId: scope.linkedOrderId,
          },
          query,
        )
        if (result.found === true && typeof result.id === "string") {
          const order = await findSupportReplyOrderSnapshot(service, { id: result.id })
          if (order) remember(order)
        }
        return result
      },
  }

  if (options?.liveChatSession && options.liveChatActor) {
    const sessionRef = { current: options.liveChatSession }
    const actor = options.liveChatActor
    lookups.proposeShippingAction = async (input) => {
      const parcel =
        input.lengthIn != null &&
        input.widthIn != null &&
        input.heightIn != null &&
        input.weightLb != null
          ? {
              lengthIn: input.lengthIn,
              widthIn: input.widthIn,
              heightIn: input.heightIn,
              weightLb: input.weightLb,
            }
          : undefined
      const proposed = await proposeLiveChatShippingAction({
        svc: service,
        session: sessionRef.current,
        actor,
        type: input.type,
        orderQuery: input.orderQuery,
        parcel,
        note: input.note,
      })
      if (!proposed.ok) {
        return {
          proposed: false,
          error: proposed.error,
          code: proposed.code ?? null,
          authRequired: proposed.code === "auth_required",
        }
      }
      sessionRef.current = proposed.session
      return {
        proposed: true,
        actionId: proposed.action.id,
        type: proposed.action.type,
        orderId: proposed.action.orderId,
        orderNum: proposed.action.orderNum,
        summary: proposed.action.summary,
        note: "Tell the customer a confirm card is ready. Do not claim the label already changed.",
      }
    }
  }

  return {
    resolvedOrders: () => [...resolved],
    lookups,
  }
}
