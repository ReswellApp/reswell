import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  collectCustomerSupportTexts,
  lastCustomerSupportText,
  rankBySupportReplyScore,
  rankExamplesForQuery,
  rankHelpArticlesForQuery,
  scoreSupportReplyOverlap,
  supportReplyDraftFingerprint,
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

  it("drops rejected examples and prefers the matching kind", () => {
    const hits = rankExamplesForQuery(
      [
        {
          id: "1",
          kind: "protection_claim",
          customer_excerpt: "The board arrived cracked and I need a refund",
          staff_reply: "Please send photos of the damage for Purchase Protection.",
          rating: "accepted" as const,
        },
        {
          id: "2",
          kind: "account",
          customer_excerpt: "I cannot reset my password",
          staff_reply: "Use the password reset link.",
          rating: "accepted" as const,
        },
        {
          id: "3",
          kind: "protection_claim",
          customer_excerpt: "Board cracked on arrival",
          staff_reply: "Rejected tone.",
          rating: "rejected" as const,
        },
      ],
      "my board arrived cracked I want a refund",
      "protection_claim",
    )
    assert.equal(hits[0]?.id, "1")
    assert.ok(hits.every((hit) => hit.rating !== "rejected"))
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
})
