import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildSupportTicketAdminAlertSms,
  shouldNotifyStaffSupportCaseOpened,
  supportTicketAdminAlertDeskUrl,
} from "./adminSupportAlerts.ts"

const CASE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

describe("adminSupportAlerts", () => {
  it("skips staff-opened cases", () => {
    assert.equal(shouldNotifyStaffSupportCaseOpened("staff"), false)
    assert.equal(shouldNotifyStaffSupportCaseOpened("requester"), true)
    assert.equal(shouldNotifyStaffSupportCaseOpened(null), true)
  })

  it("builds a short new-ticket SMS with the inbox deep link", () => {
    const ticketUrl = supportTicketAdminAlertDeskUrl({
      id: CASE_ID,
      origin: "https://www.reswell.app",
    })
    const sms = buildSupportTicketAdminAlertSms({
      kind: "case_opened",
      id: CASE_ID,
      subject: "Website contact",
      ticketUrl,
    })
    assert.match(sms, /^Reswell CS: new ticket RS-AAAAAAAA — Website contact\./)
    assert.match(sms, /admin\/contact-messages\?case=sc%3A/)
  })

  it("points live-chat cases at the live-chat desk", () => {
    const ticketUrl = supportTicketAdminAlertDeskUrl({
      id: CASE_ID,
      source_channel: "live_chat",
      origin: "https://www.reswell.app",
    })
    assert.equal(
      ticketUrl,
      `https://www.reswell.app/admin/live-chat?case=${CASE_ID}`,
    )
  })

  it("truncates a long reply preview", () => {
    const preview = "x".repeat(200)
    const sms = buildSupportTicketAdminAlertSms({
      kind: "customer_reply",
      id: CASE_ID,
      subject: "Order help",
      preview,
      ticketUrl: "https://www.reswell.app/admin/contact-messages",
    })
    assert.match(sms, /^Reswell CS: reply on RS-AAAAAAAA — x{80}…\./)
  })
})
