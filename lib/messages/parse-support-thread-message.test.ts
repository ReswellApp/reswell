import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { formatSupportTicketOpeningMessage } from "@/lib/services/supportTicketThreadNotifications"
import { parseSupportTicketOpeningContent } from "./parse-support-thread-message.ts"

describe("legacy support ticket marketplace copy", () => {
  it("still parses the historical opening so leftover DMs render as cards", () => {
    const content = formatSupportTicketOpeningMessage({
      ticketId: "11111111-1111-4111-8111-111111111111",
      topicLabel: "Website contact",
      body: "Hi! I received a 15% off first-order code.",
    })
    const parsed = parseSupportTicketOpeningContent(content)
    assert.equal(parsed?.kind, "opened")
    assert.equal(parsed?.topicLabel, "Website contact")
    assert.equal(parsed?.ticketId, "11111111-1111-4111-8111-111111111111")
    assert.equal(parsed?.body, "Hi! I received a 15% off first-order code.")
  })
})
