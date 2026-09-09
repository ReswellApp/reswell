import type { AdminOrderDetail } from "@/lib/db/adminOrders"
import type { CaseInboxItem } from "@/lib/admin/case-inbox"
import type { CaseOrderLabelContext } from "@/lib/admin/admin-order-capabilities"
import { SUPPORT_CASE_KIND_LABEL } from "@/lib/utils/support-case-display"
import { deliveryStatusLabel } from "@/lib/order-status"

export type CaseBriefing = {
  summary: string
  ask: string | null
  latestUpdate: string | null
  facts: string[]
  hints: string[]
}

type CustomerMessage = {
  author_role: string
  is_internal: boolean
  body: string
}

function uniqueTexts(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const compact = value.replace(/\s+/g, " ").trim()
    if (!compact || seen.has(compact.toLowerCase())) continue
    seen.add(compact.toLowerCase())
    out.push(compact)
  }
  return out
}

export function collectCustomerCaseTexts(
  item: Pick<CaseInboxItem, "preview" | "contact" | "order">,
  messages: CustomerMessage[],
): string[] {
  const originals: string[] = []
  if (item.order?.body?.trim()) originals.push(item.order.body)
  else if (item.contact?.message?.trim()) originals.push(item.contact.message)
  else if (item.preview.trim()) originals.push(item.preview)

  const live = messages
    .filter((message) => message.author_role === "customer" && !message.is_internal)
    .map((message) => message.body)

  return uniqueTexts([...originals, ...live])
}

export function mentionsLabelFromAddress(text: string): boolean {
  const t = text.toLowerCase()
  const aboutFrom =
    t.includes("from address") ||
    t.includes("mail from") ||
    t.includes("return address") ||
    t.includes("ship-from") ||
    t.includes("ship from")
  const aboutWrong = t.includes("incorrect") || t.includes("wrong") || t.includes("label")
  return aboutFrom && aboutWrong
}

export function mentionsIncorrectItem(text: string): boolean {
  const t = text.toLowerCase()
  const aboutItem =
    t.includes("wrong item") ||
    t.includes("incorrect item") ||
    t.includes("not as described") ||
    t.includes("not what i ordered") ||
    t.includes("not what i bought") ||
    t.includes("different from the listing") ||
    t.includes("doesn't match") ||
    t.includes("does not match")
  const aboutReturn =
    t.includes("return") || t.includes("send it back") || t.includes("sending it back")
  return aboutItem || (aboutReturn && (t.includes("wrong") || t.includes("incorrect")))
}

export function mentionsAlreadyMailed(text: string): boolean {
  const t = text.toLowerCase()
  return (
    t.includes("as is") ||
    t.includes("mailing the package") ||
    t.includes("already shipped") ||
    t.includes("already mailed") ||
    t.includes("already sent")
  )
}

function truncateQuote(text: string, max = 160): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

function orderRefLabel(item: Pick<CaseInboxItem, "orderRef">, order: AdminOrderDetail | null): string {
  const ref = item.orderRef?.trim() || order?.order_num?.trim()
  return ref ? `order ${ref}` : "this order"
}

function whoOpened(item: Pick<CaseInboxItem, "order" | "fromName">): string {
  if (item.order?.requester_role === "seller") return "The seller"
  if (item.order?.requester_role === "buyer") return "The buyer"
  return item.fromName.trim() || "The customer"
}

function aboutLine(item: Pick<CaseInboxItem, "kind" | "kindLabel">): string {
  if (item.kind === "order_question") return "order help"
  if (item.kind === "cancel_request") return "a cancel request"
  if (item.kind === "protection_claim") return "a protection claim"
  return SUPPORT_CASE_KIND_LABEL[item.kind]?.toLowerCase() || item.kindLabel.toLowerCase()
}

export function buildCaseBriefing(input: {
  item: CaseInboxItem
  messages: CustomerMessage[]
  order: AdminOrderDetail | null
  extras: CaseOrderLabelContext | null
}): CaseBriefing {
  const texts = collectCustomerCaseTexts(input.item, input.messages)
  const ask = texts[0] ?? null
  const latestUpdate = texts.length > 1 ? texts[texts.length - 1]! : null
  const blob = texts.join("\n")
  const who = whoOpened(input.item)
  const about = aboutLine(input.item)
  const ref = orderRefLabel(input.item, input.order)

  const summary = input.item.orderId
    ? `${who} opened ${about} on ${ref}.`
    : `${who} opened a ${about} case.`

  const facts: string[] = []
  const order = input.order
  if (order) {
    if (order.delivery_status && order.delivery_status !== "pending") {
      const carrier = order.tracking_carrier?.trim()
      const tracking = order.tracking_number?.trim()
      const shipBits = [carrier, tracking].filter(Boolean).join(" · ")
      facts.push(
        shipBits
          ? `The order is already marked ${deliveryStatusLabel(order.delivery_status).toLowerCase()} (${shipBits}).`
          : `The order is already marked ${deliveryStatusLabel(order.delivery_status).toLowerCase()}.`,
      )
    }
    if (order.payout?.status) {
      const hold = order.payout.hold_reason?.trim()
      facts.push(
        hold
          ? `Seller payout is ${order.payout.status} (${hold}).`
          : `Seller payout is ${order.payout.status}.`,
      )
    }
    const listingLoc = [order.listing_city, order.listing_state].filter(Boolean).join(", ")
    if (listingLoc) {
      facts.push(`Listing location used for the label FROM: ${listingLoc}.`)
    }
    if (input.extras?.shipFromOnFile) {
      facts.push(
        `Seller ship-from on file: ${input.extras.shipFromOnFile.name} · ${input.extras.shipFromOnFile.oneLine}.`,
      )
    }
  }

  const hints: string[] = []
  if (mentionsLabelFromAddress(blob)) {
    hints.push(
      "Reswell prints the label FROM from the listing city/state (often a geocoded street), which may not match the seller’s saved ship-from. Open the label to compare.",
    )
  }
  if (mentionsIncorrectItem(blob)) {
    hints.push(
      "Wrong or not-as-described item: create the prepaid return label in Item returns, then use Issue refund — item amount on this case.",
    )
  }
  if (mentionsAlreadyMailed(blob) || order?.delivery_status === "shipped") {
    if (mentionsAlreadyMailed(blob)) {
      hints.push(
        "They already mailed the package with this label. Replacing it now will not change this shipment — ask what they still need.",
      )
    }
  }

  return {
    summary,
    ask: ask ? truncateQuote(ask) : null,
    latestUpdate: latestUpdate ? truncateQuote(latestUpdate) : null,
    facts,
    hints,
  }
}
