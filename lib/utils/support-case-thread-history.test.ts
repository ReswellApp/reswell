import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { SupportCaseMessageRow } from "@/lib/db/supportCases"
import { formatSupportTicketOpeningMessage } from "@/lib/services/supportTicketThreadNotifications"
import {
  restoreSupportThreadHistory,
  supportThreadHasReadableHistory,
} from "./support-case-thread-history.ts"

const CASE_ID = "11111111-1111-4111-8111-111111111111"
const MEMBER_ID = "22222222-2222-4222-8222-222222222222"
const STAFF_ID = "33333333-3333-4333-8333-333333333333"

function message(
  partial: Partial<SupportCaseMessageRow> & Pick<SupportCaseMessageRow, "id" | "author_role" | "body">,
): SupportCaseMessageRow {
  return {
    case_id: CASE_ID,
    author_user_id: null,
    is_internal: false,
    metadata: {},
    created_at: "2026-10-01T12:00:00.000Z",
    ...partial,
  }
}

describe("restoreSupportThreadHistory", () => {
  it("does not treat a resolved system line as readable chat history", () => {
    assert.equal(
      supportThreadHasReadableHistory([
        message({
          id: "44444444-4444-4444-8444-444444444444",
          author_role: "system",
          body: "Conversation marked resolved.",
        }),
      ]),
      false,
    )
  })

  it("keeps leftover dual-written support DMs on a resolved case", () => {
    const restored = restoreSupportThreadHistory({
      existing: [
        message({
          id: "55555555-5555-4555-8555-555555555555",
          author_role: "system",
          body: "Conversation marked resolved.",
          created_at: "2026-10-02T18:00:00.000Z",
        }),
      ],
      leftover: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          sender_id: MEMBER_ID,
          content: "Board arrived cracked.",
          created_at: "2026-10-01T12:00:00.000Z",
        },
        {
          id: "77777777-7777-4777-8777-777777777777",
          sender_id: STAFF_ID,
          content: "Sorry about that — we can help.",
          created_at: "2026-10-01T13:00:00.000Z",
        },
      ],
      requesterUserId: MEMBER_ID,
      caseId: CASE_ID,
      openingBody: null,
      createdAt: "2026-10-01T12:00:00.000Z",
    })

    assert.equal(restored.length, 3)
    assert.equal(restored[0]?.author_role, "customer")
    assert.equal(restored[0]?.body, "Board arrived cracked.")
    assert.equal(restored[1]?.author_role, "agent")
    assert.equal(restored[1]?.body, "Sorry about that — we can help.")
    assert.equal(restored[2]?.author_role, "system")
  })

  it("parses the legacy marketplace opening into the customer request", () => {
    const restored = restoreSupportThreadHistory({
      existing: [],
      leftover: [
        {
          id: "88888888-8888-4888-8888-888888888888",
          sender_id: STAFF_ID,
          content: formatSupportTicketOpeningMessage({
            ticketId: CASE_ID,
            topicLabel: "Website contact",
            body: "Hi! I received a 15% off first-order code.",
          }),
          created_at: "2026-10-01T12:00:00.000Z",
        },
      ],
      requesterUserId: MEMBER_ID,
      caseId: CASE_ID,
      openingBody: null,
      createdAt: "2026-10-01T12:00:00.000Z",
    })

    assert.equal(restored.length, 1)
    assert.equal(restored[0]?.author_role, "customer")
    assert.equal(restored[0]?.body, "Hi! I received a 15% off first-order code.")
  })

  it("seeds the original request when a resolved thread has no chat rows", () => {
    const restored = restoreSupportThreadHistory({
      existing: [
        message({
          id: "99999999-9999-4999-8999-999999999999",
          author_role: "system",
          body: "Status updated to resolved.",
        }),
      ],
      leftover: [],
      requesterUserId: MEMBER_ID,
      caseId: CASE_ID,
      openingBody: "Need help with a payout.",
      createdAt: "2026-09-20T09:00:00.000Z",
    })

    assert.equal(restored[0]?.id, CASE_ID)
    assert.equal(restored[0]?.author_role, "customer")
    assert.equal(restored[0]?.body, "Need help with a payout.")
    assert.equal(restored.some((row) => row.author_role === "system"), true)
  })

  it("does not duplicate an opening that already exists on the case", () => {
    const restored = restoreSupportThreadHistory({
      existing: [
        message({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          author_role: "customer",
          body: "Board arrived cracked.",
          author_user_id: MEMBER_ID,
        }),
      ],
      leftover: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          sender_id: MEMBER_ID,
          content: "Board arrived cracked.",
          created_at: "2026-10-01T12:00:00.000Z",
        },
      ],
      requesterUserId: MEMBER_ID,
      caseId: CASE_ID,
      openingBody: "Board arrived cracked.",
      createdAt: "2026-10-01T12:00:00.000Z",
    })

    assert.equal(restored.filter((row) => row.author_role === "customer").length, 1)
  })
})
