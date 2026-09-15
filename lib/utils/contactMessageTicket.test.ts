import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { ContactMessageRow } from "../db/contactMessages.ts"
import { buildContactTicketDraft } from "./contactMessageTicket.ts"

describe("buildContactTicketDraft", () => {
  it("deep-links the inbox with the contact_message key, not sc:{message id}", () => {
    const msg: ContactMessageRow = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "Pat",
      email: "pat@example.com",
      subject: "Help",
      message: "Board never arrived",
      created_at: "2026-09-14T00:00:00.000Z",
      support_status: "ticket_created",
      internal_notes: null,
      updated_at: "2026-09-14T00:00:00.000Z",
      source: "messages_support",
      user_id: "user-1",
      related_conversation_id: null,
      support_conversation_id: "conv-1",
      assignee_admin_id: null,
    }
    const draft = buildContactTicketDraft(msg)
    assert.match(draft, /case=cm:cccccccc-cccc-4ccc-8ccc-cccccccccccc/)
    assert.doesNotMatch(draft, /case=sc:cccccccc-cccc-4ccc-8ccc-cccccccccccc/)
  })
})
