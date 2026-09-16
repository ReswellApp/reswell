import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CS_AGENT_PROMPT_VERSION,
  csAgentSystemPrompt,
  defaultCsAgentReason,
  filterCsAgentCitations,
  formatCsAgentContextPack,
} from "./cs-agent.ts"

describe("cs agent harness", () => {
  it("pins a dedicated prompt version for draft fingerprints", () => {
    assert.equal(CS_AGENT_PROMPT_VERSION, "cs-agent-v2")
  })

  it("forbids invented facts and auto-send in the system prompt", () => {
    const prompt = csAgentSystemPrompt("Hayden")
    assert.match(prompt, /never send/i)
    assert.match(prompt, /never invent/i)
    assert.match(prompt, /Greet them as Hayden/)
    assert.match(prompt, /Never address them by email/)
    assert.match(prompt, /latest customer message/i)
    assert.match(prompt, /whole conversation/i)
    assert.doesNotMatch(prompt, /fine-tune/i)
  })

  it("formats a context pack with thread, order, tickets, and help", () => {
    const pack = formatCsAgentContextPack({
      greetingName: "Sam",
      caseSubject: "Where is my board?",
      caseKind: "order_question",
      caseStatus: "submitted",
      requesterRole: "buyer",
      lastCustomerMessage: "Tracking has not moved. Can you check the refund too?",
      thread: [
        { role: "customer", body: "Where is my board?" },
        { role: "staff", body: "Looking into tracking now." },
        { role: "customer", body: "Tracking has not moved. Can you check the refund too?" },
      ],
      order: {
        id: "11111111-1111-1111-1111-111111111111",
        orderNum: "1042",
        status: "confirmed",
        amount: 350,
        fulfillmentMethod: "shipping",
        deliveryStatus: "shipped",
        trackingNumber: "1Z999",
        trackingCarrier: "ups",
        carrierDeliveredAt: null,
      },
      priorTickets: [
        {
          id: "22222222-2222-2222-2222-222222222222",
          subject: "Label question",
          status: "resolved",
          kind: "order_question",
          orderRef: "1042",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      help: [
        {
          slug: "package-delayed-or-lost",
          title: "Package delayed or lost",
          href: "/help/buying/package-delayed-or-lost",
          description: "Check tracking first.",
          body: "If tracking stalls, file a Purchase Protection claim for eligible tracked shipments.",
        },
      ],
      examples: [],
      macros: [],
    })
    assert.match(pack, /Order 1042/)
    assert.match(pack, /tracking 1Z999/)
    assert.match(pack, /Past tickets/)
    assert.match(pack, /Label question/)
    assert.match(pack, /package-delayed-or-lost/)
    assert.match(pack, /Latest customer message/)
    assert.match(pack, /Tracking has not moved. Can you check the refund too/)
    assert.match(pack, /\[customer\] Where is my board/)
    assert.match(pack, /\[staff\] Looking into tracking now/)
    assert.doesNotMatch(pack, /auto-send|already sent this reply/i)
  })

  it("drops citations the model invented", () => {
    const filtered = filterCsAgentCitations(
      {
        cited_help_slugs: ["package-delayed-or-lost", "made-up-policy"],
        cited_order_refs: ["1042", "9999"],
        cited_ticket_ids: [
          "22222222-2222-2222-2222-222222222222",
          "33333333-3333-3333-3333-333333333333",
        ],
      },
      {
        helpSlugs: ["package-delayed-or-lost"],
        orderRefs: ["1042"],
        ticketIds: ["22222222-2222-2222-2222-222222222222"],
      },
    )
    assert.deepEqual(filtered.citedHelpSlugs, ["package-delayed-or-lost"])
    assert.deepEqual(filtered.citedOrderRefs, ["1042"])
    assert.deepEqual(filtered.citedTicketIds, ["22222222-2222-2222-2222-222222222222"])
  })

  it("writes a short staff reason that never claims the reply was sent", () => {
    const reason = defaultCsAgentReason({
      origin: "llm",
      hasOrder: true,
      hasTickets: true,
      helpTitles: ["Package delayed or lost"],
    })
    assert.match(reason, /this order/)
    assert.doesNotMatch(reason, /sent|emailed/i)
  })
})
