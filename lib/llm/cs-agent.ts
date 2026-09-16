/**
 * Reswell customer-service agent harness.
 * One model, one job: draft a review-before-send reply. Never sends.
 */

export const CS_AGENT_PROMPT_VERSION = "cs-agent-v3"

/** One optional tool round, then the reply. Extra hops blow the inbox budget. */
export const CS_AGENT_MAX_STEPS = 2

/** Hard cap so the inbox never sits on a hung model call. */
export const CS_AGENT_GENERATE_TIMEOUT_MS = 4500

/** Editable first source of truth for voice, kindness, and how to write. */
export const DEFAULT_SUPPORT_REPLY_ROOT_PROMPT = `You are Reswell Support — Hayden's dedicated customer-service agent for Reswell, a used-surfboard marketplace with Purchase Protection.

This guide is the first source of truth for how you act, write, and treat people.

Voice
- Calm, kind, and specific. First-person staff ("we" / Reswell Support).
- Warm but not fluffy. No sales pitch. Do not mention that you are an AI.
- Write like a thoughtful teammate: acknowledge the person, answer what they asked, and leave them feeling looked after.
- Be kind first. Be precise second.

How to write
- Short paragraphs. Plain language. No jargon unless they used it first.
- Answer the latest customer message. The rest of the thread is background — do not restart the original ask if they already moved on.
- Use the whole conversation so you do not repeat a point staff already covered or ignore a follow-up.
- Do not paste an approved example unless it actually answers this latest message.
- If the last staff message already answered them, write a short follow-up, not a repeat.
- Keep it under 180 words unless a short numbered list is needed.
- Sign off as Reswell Support (no invented personal name).`

export type CsAgentPriorTicket = {
  id: string
  subject: string
  status: string
  kind: string
  orderRef: string | null
  updatedAt: string
}

export type CsAgentOrderFact = {
  id: string
  orderNum: string | null
  status: string
  amount: number
  fulfillmentMethod: string | null
  deliveryStatus: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
  carrierDeliveredAt: string | null
  paymentMethod?: string | null
}

export type CsAgentThreadTurn = {
  role: "customer" | "staff" | "system"
  body: string
}

export type CsAgentContextPack = {
  greetingName: string
  caseSubject: string
  caseKind: string
  caseStatus: string
  requesterRole: string
  lastCustomerMessage: string
  thread: CsAgentThreadTurn[]
  order: CsAgentOrderFact | null
  priorTickets: CsAgentPriorTicket[]
  help: Array<{ slug: string; title: string; href: string; description: string; body: string; score?: number }>
  examples: Array<{ rating: string; customerExcerpt: string; staffReply: string }>
  macros: Array<{ title: string; body: string }>
  rewriteInstruction?: string
  currentDraft?: string
}

export type CsAgentDraftOutput = {
  reply: string
  reason: string
  citedHelpSlugs: string[]
  citedOrderRefs: string[]
  citedTicketIds: string[]
  needsHumanReview: boolean
}

export function resolveSupportReplyRootPrompt(rootPrompt?: string | null): string {
  const trimmed = rootPrompt?.trim() ?? ""
  return trimmed || DEFAULT_SUPPORT_REPLY_ROOT_PROMPT
}

export function csAgentSafetyRules(greetingName: string): string {
  return `Your only job is to draft the next customer-visible reply. A human always reviews and sends. You never send.

Hard rules (facts are non-negotiable; the root guide above still owns tone and kindness):
- Never invent tracking numbers, refunds, claim approvals, payouts, or policy.
- Ground every policy claim in the help-center excerpts or approved examples in the context pack or tool results.
- If a fact is missing, ask one clear question or say you are looking into it. Do not guess.
- Do not promise a timeline Reswell has not published.
- Do not tell the customer a refund is issued or approved unless the order status is already refunded or refunding.
- Refund eligibility is staff-only context. You may say you will review; you may not promise money.
- Safety / scam reports: take them seriously, ask for the listing or conversation link, and say staff will review.
- Greet them as ${greetingName}. Never address them by email.

Draft in one shot from the context pack. Only call a tool when a required fact is missing from the pack. Prefer asking one clear question over a tool round-trip.

Also return a short staff-facing reason (why this draft) and cite only order refs, ticket ids, and help slugs you actually used.`
}

export function csAgentSystemPrompt(greetingName: string, rootPrompt?: string | null): string {
  return `${resolveSupportReplyRootPrompt(rootPrompt)}

${csAgentSafetyRules(greetingName)}`
}

export function formatCsAgentContextPack(pack: CsAgentContextPack): string {
  const orderLine = pack.order
    ? [
        `Order ${pack.order.orderNum ?? pack.order.id.slice(0, 8)}`,
        `status ${pack.order.status}`,
        pack.order.fulfillmentMethod ? `fulfillment ${pack.order.fulfillmentMethod}` : null,
        pack.order.deliveryStatus ? `delivery ${pack.order.deliveryStatus}` : null,
        pack.order.trackingNumber
          ? `tracking ${pack.order.trackingNumber}${pack.order.trackingCarrier ? ` (${pack.order.trackingCarrier})` : ""}`
          : "tracking not on file",
        `amount $${pack.order.amount.toFixed(2)}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "No order is linked."

  const tickets =
    pack.priorTickets
      .map(
        (ticket) =>
          `- ${ticket.id} · ${ticket.subject} · ${ticket.status} · ${ticket.kind}${ticket.orderRef ? ` · order ${ticket.orderRef}` : ""}`,
      )
      .join("\n") || "(none)"

  const help =
    pack.help
      .map(
        (article) =>
          `- ${article.title} (${article.href}) slug=${article.slug}\n  ${article.description}\n  ${article.body.slice(0, 700)}`,
      )
      .join("\n") || "(none matched)"

  const examples =
    pack.examples
      .map(
        (example) =>
          `- [${example.rating}] customer: ${example.customerExcerpt.slice(0, 400)}\n  staff: ${example.staffReply.slice(0, 700)}`,
      )
      .join("\n") || "(none yet — learn from future sends)"

  const macros =
    pack.macros.map((macro) => `- ${macro.title}: ${macro.body}`).join("\n") || "(none)"

  const lastCustomer = pack.lastCustomerMessage.trim() || "(no customer message yet)"
  const thread =
    pack.thread
      .map((turn) => `[${turn.role}] ${turn.body}`)
      .join("\n\n") || "(original request only)"

  const rewrite =
    pack.rewriteInstruction?.trim()
      ? `

Staff rewrite instruction (follow this for the new draft; the root guide and hard rules still come first):
${pack.rewriteInstruction.trim()}`
      : ""
  const previousDraft =
    pack.rewriteInstruction?.trim() && pack.currentDraft?.trim()
      ? `

Current draft they are rewriting (revise this; do not ignore the latest customer message):
${pack.currentDraft.trim()}`
      : ""

  return `Draft the next customer-visible reply. A human will edit and send. Never send it yourself.${rewrite}${previousDraft}

Case: ${pack.caseSubject}
Kind: ${pack.caseKind}
Status: ${pack.caseStatus}
Requester: ${pack.greetingName} (${pack.requesterRole})
${orderLine}

Latest customer message (reply to this):
${lastCustomer}

Full conversation (oldest first — context only; do not re-answer every earlier question unless the latest message still needs it):
${thread}

Past tickets for this customer (same email or account):
${tickets}

Help center articles (current, treat as policy):
${help}

Similar sent replies Hayden approved or edited:
${examples}

Saved macros (tone/structure only — adapt, do not paste blindly if facts differ):
${macros}`
}

export function filterCsAgentCitations(
  output: {
    cited_help_slugs: string[]
    cited_order_refs: string[]
    cited_ticket_ids: string[]
  },
  allowed: {
    helpSlugs: string[]
    orderRefs: string[]
    ticketIds: string[]
  },
): Pick<CsAgentDraftOutput, "citedHelpSlugs" | "citedOrderRefs" | "citedTicketIds"> {
  const help = new Set(allowed.helpSlugs)
  const orders = new Set(allowed.orderRefs.map((ref) => ref.trim().toLowerCase()).filter(Boolean))
  const tickets = new Set(allowed.ticketIds)

  const citedHelpSlugs = uniqueKeep(
    output.cited_help_slugs.filter((slug) => help.has(slug)),
    8,
  )
  const citedOrderRefs = uniqueKeep(
    output.cited_order_refs.filter((ref) => orders.has(ref.trim().toLowerCase())),
    8,
  )
  const citedTicketIds = uniqueKeep(
    output.cited_ticket_ids.filter((id) => tickets.has(id)),
    8,
  )

  return { citedHelpSlugs, citedOrderRefs, citedTicketIds }
}

function uniqueKeep(values: string[], limit: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
    if (out.length >= limit) break
  }
  return out
}

export function defaultCsAgentReason(args: {
  origin: "llm" | "example" | "macro"
  hasOrder: boolean
  hasTickets: boolean
  helpTitles: string[]
}): string {
  if (args.origin === "example") return "Closest approved reply for this kind of request."
  if (args.origin === "macro") return "Saved macro — facts still need a human check."
  const bits = [
    args.hasOrder ? "this order" : null,
    args.hasTickets ? "past tickets" : null,
    args.helpTitles[0] ? `help: ${args.helpTitles[0]}` : null,
  ].filter(Boolean)
  return bits.length > 0 ? `Grounded in ${bits.join(", ")}.` : "Drafted from the thread. Review before send."
}
