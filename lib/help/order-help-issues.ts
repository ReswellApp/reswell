import {
  canSubmitCancelRequest,
  canSubmitRefundHelpRequest,
} from "@/lib/services/orderBuyerSupport"
import { deliveryStatusLabel, orderStatusLabel } from "@/lib/order-status"
import type { OrderHelpIssueId } from "@/lib/types/supportCase"
import type { HelpHubOrderOption } from "@/lib/services/supportCases"

export type ContextualOrderHelpIssue = {
  id: OrderHelpIssueId
  title: string
  hint: string
  requestType: "help" | "cancel_order" | "refund_help"
  asksContactedSeller: boolean
}

export type OrderHelpFormCopy = {
  pageTitle: string
  pageSubtitle: string
  roleBadge: string
  contextTitle: string
  detailsLabel: string
  detailsPlaceholder: string
  detailsHint: string
  tips: string[]
  submitLabel: string
  successToast: string
  /** Buyer: link to message seller. Seller: link to message buyer via order sale page. */
  peerMessage?: { label: string; href: string }
}

function isFulfilled(deliveryStatus: string): boolean {
  return deliveryStatus === "delivered" || deliveryStatus === "picked_up"
}

function isInTransit(deliveryStatus: string): boolean {
  return deliveryStatus === "shipped"
}

function isPreShip(order: HelpHubOrderOption): boolean {
  if (order.fulfillmentMethod === "pickup") {
    return order.deliveryStatus === "pending" || order.deliveryStatus === "pickup_ready"
  }
  return order.deliveryStatus === "pending"
}

/** Short status line for order chips in Help Hub. */
export function helpHubOrderStatusLine(order: HelpHubOrderOption): string {
  if (order.status === "refunded") return "Refunded"
  if (order.status === "refunding") return "Refund in progress"
  if (order.status === "pending") return "Payment pending"

  const delivery = deliveryStatusLabel(order.deliveryStatus)
  if (order.fulfillmentMethod === "pickup") {
    if (order.deliveryStatus === "pending") return "Awaiting pickup setup"
    return delivery
  }
  if (order.fulfillmentMethod === "shipping") {
    if (order.deliveryStatus === "pending") return "Awaiting shipment"
    return delivery
  }
  return orderStatusLabel(order.status)
}

/**
 * Issue choices for a specific order — titles/hints and visibility follow
 * role + fulfillment + delivery state.
 */
export function contextualOrderHelpIssues(
  order: HelpHubOrderOption,
): ContextualOrderHelpIssue[] {
  const issues: ContextualOrderHelpIssue[] = []
  const isBuyer = order.role === "buyer"
  const refunded = order.status === "refunded" || order.status === "refunding"

  if (refunded) {
    if (isBuyer) {
      issues.push({
        id: "question",
        title: order.status === "refunding" ? "Ask about my refund" : "Question about this refund",
        hint:
          order.status === "refunding"
            ? "Timing, card vs wallet, or something that looks wrong."
            : "Receipt, wallet credit, or something else about this refunded purchase.",
        requestType: "help",
        asksContactedSeller: false,
      })
    } else {
      issues.push({
        id: "question",
        title: order.status === "refunding" ? "Ask about this refund" : "Question after a refund",
        hint:
          order.status === "refunding"
            ? "Payout hold, clawback timing, or what the buyer was told."
            : "Earnings impact, what happened, or next steps for this sale.",
        requestType: "help",
        asksContactedSeller: false,
      })
    }
    return issues
  }

  if (order.status !== "confirmed" && order.status !== "pending") {
    issues.push({
      id: "question",
      title: isBuyer ? "Question about this purchase" : "Question about this sale",
      hint: "Tell us what’s going on and we’ll help.",
      requestType: "help",
      asksContactedSeller: false,
    })
    return issues
  }

  // ── Cancel ──────────────────────────────────────────────────
  if (
    isBuyer &&
    canSubmitCancelRequest({
      status: order.status,
      delivery_status: order.deliveryStatus,
      fulfillment_method: order.fulfillmentMethod,
    })
  ) {
    const pickup = order.fulfillmentMethod === "pickup"
    issues.push({
      id: "cancel",
      title: pickup ? "Cancel this pickup" : "Cancel before it ships",
      hint: pickup
        ? order.deliveryStatus === "pickup_ready"
          ? "Ready for pickup — cancel only if you haven’t completed it."
          : "Cancel before you meet the seller."
        : "Hasn’t shipped yet. We’ll help unwind the purchase.",
      requestType: "cancel_order",
      asksContactedSeller: false,
    })
  } else if (!isBuyer && isPreShip(order) && order.status === "confirmed") {
    issues.push({
      id: "cancel",
      title: "I can’t fulfill this sale",
      hint:
        order.fulfillmentMethod === "pickup"
          ? "Need to cancel before the buyer picks up — board sold elsewhere, can’t meet, etc."
          : "Need to cancel before you ship — inventory issue, damage, or can’t send.",
      requestType: "cancel_order",
      asksContactedSeller: false,
    })
  }

  // ── Buyer protection / claim ────────────────────────────────
  if (
    isBuyer &&
    canSubmitRefundHelpRequest({
      status: order.status,
      delivery_status: order.deliveryStatus,
      fulfillment_method: order.fulfillmentMethod,
    }) &&
    (isInTransit(order.deliveryStatus) || isFulfilled(order.deliveryStatus))
  ) {
    if (isInTransit(order.deliveryStatus)) {
      issues.push({
        id: "claim",
        title: "Package missing or stuck",
        hint: "Not arriving, tracking stopped, or marked delivered and you don’t have it.",
        requestType: "refund_help",
        asksContactedSeller: true,
      })
    } else if (order.deliveryStatus === "delivered") {
      issues.push({
        id: "claim",
        title: "Start a Purchase Protection claim",
        hint: "Damaged in shipping, not as described, or missing parts.",
        requestType: "refund_help",
        asksContactedSeller: true,
      })
    } else if (order.deliveryStatus === "picked_up") {
      issues.push({
        id: "claim",
        title: "Problem after pickup",
        hint: "Not as described or something else wrong after you picked it up.",
        requestType: "refund_help",
        asksContactedSeller: true,
      })
    }
  }

  // ── Seller: buyer dispute / payout (post-fulfillment) ────────
  if (!isBuyer && (isInTransit(order.deliveryStatus) || isFulfilled(order.deliveryStatus))) {
    issues.push({
      id: "claim",
      title: isInTransit(order.deliveryStatus)
        ? "Buyer issue with this shipment"
        : "Buyer dispute or claim",
      hint: isInTransit(order.deliveryStatus)
        ? "Buyer says it’s lost, delayed, or needs an update — get Reswell involved."
        : "Buyer opened a claim, wants a refund, or says the item’s wrong.",
      requestType: "refund_help",
      asksContactedSeller: false,
    })
  }

  // ── Contextual question ─────────────────────────────────────
  if (isBuyer) {
    if (isPreShip(order)) {
      issues.push({
        id: "question",
        title: "Question before it ships",
        hint:
          order.fulfillmentMethod === "pickup"
            ? "Meetup time, pickup code, or seller communication."
            : "Ship-to address, timing, or something the seller said.",
        requestType: "help",
        asksContactedSeller: false,
      })
    } else if (isInTransit(order.deliveryStatus)) {
      issues.push({
        id: "question",
        title: "Question about my delivery",
        hint: "Tracking, ETA, carrier delay, or changing the address.",
        requestType: "help",
        asksContactedSeller: false,
      })
    } else if (isFulfilled(order.deliveryStatus)) {
      issues.push({
        id: "question",
        title: "Other question about this purchase",
        hint: "Receipt, review, or something that isn’t a protection claim.",
        requestType: "help",
        asksContactedSeller: false,
      })
    } else {
      issues.push({
        id: "question",
        title: "Question about this purchase",
        hint: "Tracking, timing, or anything else.",
        requestType: "help",
        asksContactedSeller: false,
      })
    }
  } else if (isPreShip(order)) {
    issues.push({
      id: "question",
      title:
        order.fulfillmentMethod === "pickup"
          ? "Help with pickup"
          : "Help shipping this sale",
      hint:
        order.fulfillmentMethod === "pickup"
          ? "Pickup code, meetup location, or buyer not responding."
          : "Label, packing, rates, address, or buyer questions before you ship.",
      requestType: "help",
      asksContactedSeller: false,
    })
  } else if (isInTransit(order.deliveryStatus)) {
    issues.push({
      id: "question",
      title: "Help with this shipment",
      hint: "Label reprint, tracking weirdness, carrier damage, or what to tell the buyer.",
      requestType: "help",
      asksContactedSeller: false,
    })
  } else {
    issues.push({
      id: "question",
      title: "Payout or post-sale question",
      hint: "When you’ll get paid, earnings hold, or something after delivery/pickup.",
      requestType: "help",
      asksContactedSeller: false,
    })
  }

  return issues
}

/** Prompt under the H1 on the issue-picker step. */
export function orderHelpIssuePrompt(order: HelpHubOrderOption): string {
  if (order.status === "refunded" || order.status === "refunding") {
    return order.role === "seller"
      ? "This sale has a refund. What do you need from us?"
      : "This purchase has a refund. What do you need?"
  }
  if (order.role === "seller") {
    if (isPreShip(order)) return "You’re the seller — this sale isn’t fulfilled yet. What do you need?"
    if (isInTransit(order.deliveryStatus)) {
      return "You’re the seller — this sale is in transit. What do you need?"
    }
    if (isFulfilled(order.deliveryStatus)) {
      return "You’re the seller — this sale is complete. What do you need?"
    }
    return "You’re the seller on this order. What do you need?"
  }
  if (isPreShip(order)) {
    return order.fulfillmentMethod === "pickup"
      ? "You’re the buyer — pickup isn’t finished. What do you need?"
      : "You’re the buyer — this hasn’t shipped yet. What do you need?"
  }
  if (isInTransit(order.deliveryStatus)) {
    return "You’re the buyer — it’s on the way. What do you need?"
  }
  if (order.deliveryStatus === "delivered") {
    return "You’re the buyer — it’s marked delivered. What do you need?"
  }
  if (order.deliveryStatus === "picked_up") {
    return "You’re the buyer — pickup is complete. What do you need?"
  }
  return "You’re the buyer on this order. What do you need?"
}

/** Page + form copy for the details step — fully role- and issue-aware. */
export function orderHelpFormCopy(
  order: HelpHubOrderOption,
  issue: ContextualOrderHelpIssue,
): OrderHelpFormCopy {
  const isBuyer = order.role === "buyer"
  const status = helpHubOrderStatusLine(order)
  const roleBadge = isBuyer ? "Your purchase" : "Your sale"
  const peerHref = isBuyer
    ? `/dashboard/purchases/${order.id}`
    : `/dashboard/sales/${order.id}`

  const base = {
    roleBadge,
    contextTitle: `${issue.title} · ${order.orderRef} · ${status}`,
  }

  // ── Seller ──────────────────────────────────────────────────
  if (!isBuyer) {
    if (issue.id === "cancel") {
      return {
        ...base,
        pageTitle: "Cancel this sale",
        pageSubtitle:
          "Tell us why you can’t fulfill it. We’ll review with the buyer and help unwind the order.",
        detailsLabel: "Why can’t you fulfill this sale?",
        detailsPlaceholder:
          "e.g. Board already sold, damaged before ship, can’t make pickup, buyer asked to cancel…",
        detailsHint: "Be specific — we message the buyer from what you write here.",
        tips: [
          "Don’t ship once you’ve asked us to cancel.",
          "If the buyer already paid shipping, note that.",
        ],
        submitLabel: "Request cancellation",
        successToast: "Cancellation request sent — we’ll follow up in Support.",
        peerMessage: { label: "Open this sale", href: peerHref },
      }
    }

    if (issue.id === "claim") {
      return {
        ...base,
        pageTitle: isInTransit(order.deliveryStatus)
          ? "Buyer shipment issue"
          : "Buyer dispute help",
        pageSubtitle: isInTransit(order.deliveryStatus)
          ? "Share what the buyer said and what you’ve already tried with the carrier."
          : "Share the buyer’s complaint and any photos or messages you have.",
        detailsLabel: "What is the buyer reporting?",
        detailsPlaceholder: isInTransit(order.deliveryStatus)
          ? "e.g. Buyer says tracking stopped in LA, or marked delivered but they don’t have it…"
          : "e.g. Buyer says the board arrived cracked / not as listed / wants a refund…",
        detailsHint: "Include dates and whether you’ve already replied to the buyer.",
        tips: [
          "Keep talking to the buyer in Messages when you can.",
          "We’ll coordinate Purchase Protection or carrier next steps.",
        ],
        submitLabel: "Get Reswell involved",
        successToast: "Case opened — we’ll help you handle this with the buyer.",
        peerMessage: { label: "Open this sale", href: peerHref },
      }
    }

    // Seller question
    if (isPreShip(order)) {
      return {
        ...base,
        pageTitle:
          order.fulfillmentMethod === "pickup" ? "Pickup help" : "Shipping help",
        pageSubtitle:
          order.fulfillmentMethod === "pickup"
            ? "We’ll help you get this pickup done cleanly."
            : "Labels, packing, rates, or buyer questions before you ship.",
        detailsLabel: "What do you need help with?",
        detailsPlaceholder:
          order.fulfillmentMethod === "pickup"
            ? "e.g. Buyer isn’t responding, unsure about pickup code, meetup location…"
            : "e.g. Label won’t download, wrong ship-to, need a different rate, packing tips…",
        detailsHint: "Include screenshots of errors if something’s broken.",
        tips: [
          "Ship from your sales page when you’re ready.",
          "Message the buyer if timing changes.",
        ],
        submitLabel: "Message Support",
        successToast: "Sent — reply anytime under Support.",
        peerMessage: { label: "Open this sale", href: peerHref },
      }
    }

    if (isInTransit(order.deliveryStatus)) {
      return {
        ...base,
        pageTitle: "Help with this shipment",
        pageSubtitle: "You’re the seller on a package that’s already moving.",
        detailsLabel: "What’s going on with the shipment?",
        detailsPlaceholder:
          "e.g. Need a label reprint, tracking looks wrong, carrier damaged it, buyer asking for ETA…",
        detailsHint: "Paste the tracking number if you have it handy.",
        tips: [
          "Carrier claims usually need photos of damage and packaging.",
          "Don’t promise the buyer a refund until we align.",
        ],
        submitLabel: "Message Support",
        successToast: "Sent — we’ll help from the seller side.",
        peerMessage: { label: "Open this sale", href: peerHref },
      }
    }

    return {
      ...base,
      pageTitle: "Sale question",
      pageSubtitle: "Payouts, holds, or anything after this sale completed.",
      detailsLabel: "What should we know?",
      detailsPlaceholder:
        "e.g. When does payout release, earnings still held, buyer left a review issue…",
      detailsHint: "Mention dates if it’s about payout timing.",
      tips: ["Payouts often wait on delivery + a short protection window."],
      submitLabel: "Message Support",
      successToast: "Sent — track replies under Support.",
      peerMessage: { label: "Open this sale", href: peerHref },
    }
  }

  // ── Buyer ───────────────────────────────────────────────────
  if (issue.id === "cancel") {
    return {
      ...base,
      pageTitle: "Cancel this purchase",
      pageSubtitle:
        order.fulfillmentMethod === "pickup"
          ? "We’ll review before pickup is completed."
          : "We’ll review before the seller ships.",
      detailsLabel: "Why do you want to cancel?",
      detailsPlaceholder:
        "e.g. Ordered by mistake, found another board, seller asked me to cancel, need it sooner…",
      detailsHint: "If the seller already agreed, say so — it speeds things up.",
      tips: [
        "If it’s already shipped, cancel usually isn’t available — use a claim or shipping question instead.",
      ],
      submitLabel: "Request cancellation",
      successToast: "Cancellation request sent — we’ll update you in Support.",
      peerMessage: { label: "Message the seller", href: peerHref },
    }
  }

  if (issue.id === "claim") {
    const inTransit = isInTransit(order.deliveryStatus)
    return {
      ...base,
      pageTitle: inTransit ? "Missing or stuck package" : "Purchase Protection claim",
      pageSubtitle: inTransit
        ? "We’ll help with carrier tracking and next steps."
        : "Eligible purchases can get repair credit or a refund when something’s wrong.",
      detailsLabel: inTransit ? "What’s happening with delivery?" : "What went wrong?",
      detailsPlaceholder: inTransit
        ? "e.g. Tracking hasn’t moved in 5 days, marked delivered but not at my door, last scan was…"
        : "e.g. Nose crushed in the box, ding not in photos, fins missing, arrived wet…",
      detailsHint: inTransit
        ? "Include the last tracking update you see."
        : "Photos of damage and packaging help a lot — add them below.",
      tips: inTransit
        ? ["Message the seller too — they often see carrier updates first."]
        : [
            "Take clear photos of the board, box, and packing.",
            "We’ll tell you if this fits Purchase Protection.",
          ],
      submitLabel: inTransit ? "Open shipping case" : "Start claim",
      successToast: "Claim started — upload more evidence anytime in Support.",
      peerMessage: { label: "Message the seller", href: peerHref },
    }
  }

  // Buyer question
  if (isPreShip(order)) {
    return {
      ...base,
      pageTitle: "Question about your purchase",
      pageSubtitle:
        order.fulfillmentMethod === "pickup"
          ? "Pickup isn’t done yet — ask us or the seller."
          : "Hasn’t shipped yet — address, timing, or seller communication.",
      detailsLabel: "What’s your question?",
      detailsPlaceholder:
        order.fulfillmentMethod === "pickup"
          ? "e.g. When can I pick up, where do we meet, seller isn’t replying…"
          : "e.g. Can I change the ship-to, when will they ship, seller said…",
      detailsHint: "We’ll open a Support chat so you can keep the thread going.",
      tips: ["For quick answers, message the seller on the order too."],
      submitLabel: "Message Support",
      successToast: "Sent — reply anytime under Support.",
      peerMessage: { label: "Message the seller", href: peerHref },
    }
  }

  if (isInTransit(order.deliveryStatus)) {
    return {
      ...base,
      pageTitle: "Question about your delivery",
      pageSubtitle: "Your package is in transit — ask about tracking, ETA, or the address.",
      detailsLabel: "What’s your question?",
      detailsPlaceholder:
        "e.g. What’s the ETA, can I change the address, tracking link isn’t updating…",
      detailsHint: "Paste tracking details if you have them.",
      tips: [
        "If it’s lost or marked delivered without the board, use the missing-package option instead.",
      ],
      submitLabel: "Message Support",
      successToast: "Sent — we’ll help track it down.",
      peerMessage: { label: "Message the seller", href: peerHref },
    }
  }

  return {
    ...base,
    pageTitle: "Question about your purchase",
    pageSubtitle: "Receipts, reviews, or anything that isn’t a protection claim.",
    detailsLabel: "What’s your question?",
    detailsPlaceholder: "e.g. Where’s my receipt, how do I leave a review, wallet credit…",
    detailsHint: "We’ll open a Support chat with our team.",
    tips: [],
    submitLabel: "Message Support",
    successToast: "Sent — track replies under Support.",
    peerMessage: { label: "View this purchase", href: peerHref },
  }
}
