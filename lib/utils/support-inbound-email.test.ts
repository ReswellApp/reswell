import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { formatSupportCaseReference } from "./support-case-display.ts"
import {
  buildKlaviyoSupportInboundThreading,
  collectSupportInboundCaseHints,
  extractEmailAddress,
  extractUuidFromPlusAddress,
  formatSupportInboundReplyTo,
  htmlToPlainText,
  inboundEmailPlainBody,
  inboundEmailsMatch,
  isAutomatedInboundEmail,
  isReswellTransactionalSender,
  normalizeEmailForMatch,
  stripQuotedReply,
} from "./support-inbound-email.ts"

const CASE_ID = "550e8400-e29b-41d4-a716-446655440000"

describe("support inbound email parsing", () => {
  it("extracts a bare address from a display name", () => {
    assert.equal(extractEmailAddress("Jane Doe <jane@example.com>"), "jane@example.com")
    assert.equal(extractEmailAddress("jane@example.com"), "jane@example.com")
    assert.equal(extractEmailAddress("not-an-email"), null)
  })

  it("matches plus-tagged Gmail to the stored address", () => {
    assert.equal(normalizeEmailForMatch("Jane+orders@Gmail.com"), "jane@gmail.com")
    assert.equal(inboundEmailsMatch("jane+tag@gmail.com", "Jane@gmail.com"), true)
    assert.equal(inboundEmailsMatch("other@example.com", "jane@example.com"), false)
  })

  it("reads the case UUID from a plus-addressed Reply-To", () => {
    assert.equal(
      extractUuidFromPlusAddress(`Support <support+${CASE_ID}@reswell.app>`),
      CASE_ID,
    )
    assert.equal(
      extractUuidFromPlusAddress("support+550e8400e29b41d4a716446655440000@reswell.app"),
      CASE_ID,
    )
  })

  it("builds a plus-addressed Reply-To", () => {
    assert.equal(
      formatSupportInboundReplyTo("support@reswell.app", CASE_ID),
      `support+${CASE_ID}@reswell.app`,
    )
    assert.equal(formatSupportInboundReplyTo("not-an-email", CASE_ID), null)
  })

  it("threads Klaviyo case_ref and reply_to on the support case UUID, not a contact_messages id", () => {
    const contactMessageId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    assert.notEqual(
      formatSupportCaseReference(contactMessageId),
      formatSupportCaseReference(CASE_ID),
    )
    const fields = buildKlaviyoSupportInboundThreading({
      supportTicketId: contactMessageId,
      supportCaseId: CASE_ID,
      mailbox: "support@reswell.app",
    })
    assert.equal(fields.threadingCaseId, CASE_ID)
    assert.equal(fields.caseRef, formatSupportCaseReference(CASE_ID))
    assert.equal(fields.caseRef, "RS-550E8400")
    assert.equal(fields.replyTo, `support+${CASE_ID}@reswell.app`)
  })

  it("finds case ids from subject, body, URL, and plus-address", () => {
    const hints = collectSupportInboundCaseHints({
      to: [`support+${CASE_ID}@reswell.app`],
      subject: "Re: Reswell Support RS-550E8400",
      text: `Thanks — still waiting.\nCase ID: ${CASE_ID}\nhttps://www.reswell.app/support/${CASE_ID}`,
    })
    assert.deepEqual(hints.caseIds, [CASE_ID])
    assert.deepEqual(hints.caseRefs, ["RS-550E8400"])
  })

  it("finds inbox deep links", () => {
    const hints = collectSupportInboundCaseHints({
      subject: "follow up",
      text: `https://www.reswell.app/admin/contact-messages?case=sc:${CASE_ID}`,
    })
    assert.deepEqual(hints.caseIds, [CASE_ID])
  })

  it("strips Gmail quoted history", () => {
    const body = inboundEmailPlainBody({
      text: [
        "Still damaged — photos coming.",
        "",
        "On Mon, Sep 14, 2026 at 1:02 PM Reswell Support wrote:",
        "> Hey — we are looking into this.",
        `> Case ID: ${CASE_ID}`,
      ].join("\n"),
    })
    assert.equal(body, "Still damaged — photos coming.")
  })

  it("strips Outlook-style quotes and HTML", () => {
    assert.equal(
      stripQuotedReply("Thanks.\n-----Original Message-----\nFrom: Reswell"),
      "Thanks.",
    )
    assert.equal(htmlToPlainText("<p>Hi</p><br>there"), "Hi\n\nthere")
  })

  it("drops auto-replies and Reswell transactional senders", () => {
    assert.equal(
      isAutomatedInboundEmail({ subject: "Automatic reply: Out of office", from: "jane@x.com" }),
      true,
    )
    assert.equal(
      isAutomatedInboundEmail({
        from: "jane@x.com",
        headers: { "Auto-Submitted": "auto-replied" },
      }),
      true,
    )
    assert.equal(isAutomatedInboundEmail({ from: "jane@x.com", subject: "Re: case" }), false)
    assert.equal(isReswellTransactionalSender("noreply@reswell.app"), true)
    assert.equal(
      isReswellTransactionalSender("support+abc@reswell.app", "support@reswell.app"),
      true,
    )
    assert.equal(isReswellTransactionalSender("customer@gmail.com"), false)
  })
})
