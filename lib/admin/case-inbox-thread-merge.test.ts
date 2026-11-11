import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mergeThreadMessagesWithPendingLocal } from "./case-inbox-thread-merge.ts"
import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"

function msg(
  partial: Partial<SupportCaseThreadMessage> & Pick<SupportCaseThreadMessage, "id" | "author_role" | "body">,
): SupportCaseThreadMessage {
  return {
    case_id: "case-1",
    author_user_id: null,
    is_internal: false,
    metadata: {},
    created_at: "2026-11-07T20:00:00.000Z",
    ...partial,
  }
}

describe("mergeThreadMessagesWithPendingLocal", () => {
  it("keeps previous messages when the server returns an empty thread", () => {
    const prev = [
      msg({ id: "cust-1", author_role: "customer", body: "I don't see the funds" }),
      msg({
        id: "local-1",
        author_role: "agent",
        body: "Checking payout status now",
        created_at: "2026-11-07T20:01:00.000Z",
      }),
    ]
    assert.deepEqual(mergeThreadMessagesWithPendingLocal(prev, []), prev)
  })

  it("keeps optimistic local agent replies when reload only has the customer opener", () => {
    const prev = [
      msg({ id: "cust-1", author_role: "customer", body: "I don't see the funds" }),
      msg({
        id: "local-99",
        author_role: "agent",
        body: "Thanks — looking into this now.",
        created_at: "2026-11-07T20:01:00.000Z",
      }),
    ]
    const server = [msg({ id: "cust-1", author_role: "customer", body: "I don't see the funds" })]
    const merged = mergeThreadMessagesWithPendingLocal(prev, server)
    assert.equal(merged.length, 2)
    assert.equal(merged[1]?.id, "local-99")
    assert.equal(merged[1]?.body, "Thanks — looking into this now.")
  })

  it("drops local bubbles once the server includes the same agent body", () => {
    const prev = [
      msg({ id: "cust-1", author_role: "customer", body: "Help" }),
      msg({ id: "local-2", author_role: "agent", body: "On it" }),
    ]
    const server = [
      msg({ id: "cust-1", author_role: "customer", body: "Help" }),
      msg({ id: "agent-db", author_role: "agent", body: "On it", created_at: "2026-11-07T20:02:00.000Z" }),
    ]
    const merged = mergeThreadMessagesWithPendingLocal(prev, server)
    assert.deepEqual(
      merged.map((row) => row.id),
      ["cust-1", "agent-db"],
    )
  })
})
