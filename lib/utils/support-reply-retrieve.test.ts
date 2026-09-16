import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  collectCustomerSupportTexts,
  formatSupportConversation,
  lastCustomerSupportText,
  rankBySupportReplyScore,
  supportReplyRetrievalQuery,
  rankExamplesForQuery,
  rankHelpArticlesForQuery,
  scoreSupportReplyOverlap,
  supportReplyDraftFingerprint,
  selectOpenCaseIdsNeedingDraft,
  tokenizeSupportReplyQuery,
} from "./support-reply-retrieve.ts"

describe("support reply retrieval", () => {
  it("drops stop words and short tokens", () => {
    assert.deepEqual(tokenizeSupportReplyQuery("How do I get a refund for my order?"), [
      "get",
      "refund",
      "order",
    ])
  })

  it("scores overlapping tokens", () => {
    const tokens = tokenizeSupportReplyQuery("damaged board never arrived")
    const high = scoreSupportReplyOverlap(
      tokens,
      "Purchase Protection covers a damaged board that never arrived",
    )
    const low = scoreSupportReplyOverlap(tokens, "How do I change my profile photo")
    assert.ok(high > low)
    assert.ok(high > 0.5)
  })

  it("ranks by score and drops zeros", () => {
    const ranked = rankBySupportReplyScore(
      [
        { id: "a", text: "refund shipping label" },
        { id: "b", text: "unrelated profile password" },
        { id: "c", text: "damaged item refund cracked" },
      ],
      (row) => scoreSupportReplyOverlap(tokenizeSupportReplyQuery("damaged refund cracked"), row.text),
      2,
    )
    assert.deepEqual(
      ranked.map((row) => row.id),
      ["c", "a"],
    )
  })

  it("ranks help articles by title and keyword overlap", () => {
    const hits = rankHelpArticlesForQuery(
      [
        {
          title: "How do I buy on Reswell?",
          keywords: ["buy", "checkout"],
          description: "Find boards and check out.",
          body: "Tap Buy it now.",
        },
        {
          title: "How do I change my profile?",
          keywords: ["profile", "password"],
          description: "Update your display name.",
          body: "Go to Profile.",
        },
      ],
      "how do I buy a board and check out",
    )
    assert.equal(hits[0]?.title, "How do I buy on Reswell?")
  })

  it("drops bad examples and prefers the matching kind", () => {
    const hits = rankExamplesForQuery(
      [
        {
          id: "1",
          kind: "protection_claim",
          customer_excerpt: "The board arrived cracked and I need a refund",
          staff_reply: "Please send photos of the damage for Purchase Protection.",
          rating: "very_good" as const,
        },
        {
          id: "2",
          kind: "account",
          customer_excerpt: "I cannot reset my password",
          staff_reply: "Use the password reset link.",
          rating: "very_good" as const,
        },
        {
          id: "3",
          kind: "protection_claim",
          customer_excerpt: "Board cracked on arrival",
          staff_reply: "Rejected tone.",
          rating: "bad" as const,
        },
      ],
      "my board arrived cracked I want a refund",
      "protection_claim",
    )
    assert.equal(hits[0]?.id, "1")
    assert.ok(hits.every((hit) => hit.rating !== "bad"))
  })

  it("changes fingerprint when the customer message changes", () => {
    const base = {
      promptVersion: "support-reply-draft-v1",
      caseId: "11111111-1111-1111-1111-111111111111",
      subject: "Order help",
      status: "submitted",
      lastCustomerMessage: "Where is my board?",
      lastMessageAt: "2026-09-14T00:00:00.000Z",
    }
    const first = supportReplyDraftFingerprint(base)
    const second = supportReplyDraftFingerprint({
      ...base,
      lastCustomerMessage: "It still has not arrived.",
    })
    assert.notEqual(first, second)
    assert.equal(first, supportReplyDraftFingerprint(base))
    assert.notEqual(
      first,
      supportReplyDraftFingerprint({ ...base, rootPrompt: "Be kinder." }),
    )
  })

  it("uses real customer messages and ignores staff preview text", () => {
    const messages = [
      { author_role: "customer", is_internal: false, body: "Where is my board?" },
      { author_role: "agent", is_internal: false, body: "Looking into tracking now." },
    ]
    assert.deepEqual(collectCustomerSupportTexts(messages, "Order help"), ["Where is my board?"])
    assert.equal(lastCustomerSupportText(messages, "Order help"), "Where is my board?")
    assert.equal(
      lastCustomerSupportText(
        [{ author_role: "agent", is_internal: false, body: "Looking into tracking now." }],
        "Order help",
      ),
      "Order help",
    )
  })

  it("formats the visible thread in chronological order", () => {
    const formatted = formatSupportConversation([
      { author_role: "customer", is_internal: false, body: "Where is my wallet credit?" },
      { author_role: "agent", is_internal: true, body: "Staff-only note" },
      { author_role: "agent", is_internal: false, body: "Checking payouts now." },
      { author_role: "customer", is_internal: false, body: "Actually I need the return label." },
    ])
    assert.match(formatted, /\[customer\] Where is my wallet credit/)
    assert.match(formatted, /\[staff\] Checking payouts now/)
    assert.match(formatted, /\[customer\] Actually I need the return label/)
    assert.doesNotMatch(formatted, /Staff-only note/)
    assert.ok(formatted.indexOf("wallet credit") < formatted.indexOf("return label"))
  })

  it("retrieves on the last customer message when it is substantial", () => {
    const query = supportReplyRetrievalQuery({
      lastCustomerMessage: "The board arrived cracked and I need a refund",
      conversation: "Can I use wallet balance at checkout?\nThe board arrived cracked and I need a refund",
      subject: "Wallet balance",
    })
    assert.equal(query, "The board arrived cracked and I need a refund")
    assert.doesNotMatch(query, /wallet|Wallet/)
  })

  it("uses the full conversation when the last message is too short to retrieve on", () => {
    const query = supportReplyRetrievalQuery({
      lastCustomerMessage: "Yes please",
      conversation: "[customer] Can I use wallet balance at checkout?\n[staff] Yes on eligible orders.\n[customer] Yes please",
      subject: "Wallet balance",
    })
    assert.match(query, /wallet balance/i)
    assert.match(query, /Yes please/)
  })

  it("queues cases with no draft or a customer message newer than the draft", () => {
    const ids = selectOpenCaseIdsNeedingDraft({
      caseIds: ["a", "b", "c", "d"],
      draftUpdatedAtByCaseId: new Map([
        ["b", "2026-09-16T10:00:00.000Z"],
        ["c", "2026-09-16T12:00:00.000Z"],
        ["d", "2026-09-16T12:00:00.000Z"],
      ]),
      lastCustomerAtByCaseId: new Map([
        ["b", "2026-09-16T11:00:00.000Z"],
        ["c", "2026-09-16T11:00:00.000Z"],
        ["d", "2026-09-16T12:00:00.000Z"],
      ]),
      limit: 3,
    })
    assert.deepEqual(ids, ["a", "b"])
  })
})
