type SellerOutreachCaseKind =
  | "general"
  | "order_question"
  | "cancel_request"
  | "protection_claim"
  | "safety"
  | "payments"
  | "account"

export function sellerOutreachIssueSummary(
  kind: SellerOutreachCaseKind,
  customerText: string,
): string {
  const text = customerText.toLowerCase()
  const cannotReachSeller =
    text.includes("no response") ||
    text.includes("not responding") ||
    text.includes("hasn't responded") ||
    text.includes("has not responded") ||
    text.includes("ghosting") ||
    text.includes("tried to contact")

  if (cannotReachSeller) {
    return "The buyer has been trying to reach you about coordinating this order and has not received a response."
  }
  if (text.includes("local pickup") || text.includes("pick up") || text.includes("pickup")) {
    return "The buyer needs help coordinating local pickup for this order."
  }
  if (
    text.includes("wrong item") ||
    text.includes("not as described") ||
    text.includes("doesn't match") ||
    text.includes("does not match")
  ) {
    return "The buyer reported that the item may not match the listing."
  }
  if (
    text.includes("damaged") ||
    text.includes("damage") ||
    text.includes("broken")
  ) {
    return "The buyer reported a possible condition or delivery issue with the order."
  }
  if (kind === "cancel_request" || text.includes("cancel")) {
    return "The buyer asked Reswell for help with a cancellation request."
  }
  if (kind === "protection_claim") {
    return "The buyer asked Reswell to review a Purchase Protection concern for this order."
  }
  if (kind === "payments") {
    return "The buyer asked Reswell for help with a payment-related question about this order."
  }
  if (kind === "safety") {
    return "The buyer asked Reswell for help resolving a trust or communication concern related to this order."
  }
  return "The buyer asked Reswell for help with this order."
}

export function buildSellerSupportOutreachDraft(args: {
  sellerUsername: string | null
  orderRef: string
  kind: SellerOutreachCaseKind
  customerText: string
}): string {
  const greeting = args.sellerUsername?.trim() || "there"
  const summary = sellerOutreachIssueSummary(args.kind, args.customerText)

  return `Hi ${greeting},

Reswell Support here. We’re helping with order ${args.orderRef}.

${summary}

Could you reply with a brief update and the next step you can take?

Thanks,
Reswell Support`
}
