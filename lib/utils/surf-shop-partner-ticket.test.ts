import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  SURF_SHOP_PARTNER_OPS_NOTE,
  buildSurfShopPartnerCustomerMessage,
  buildSurfShopPartnerOpsNotes,
  surfShopPartnerLinkedUserId,
} from "./surf-shop-partner-ticket.ts"

const serviceSource = readFileSync(
  new URL("../services/surfShopPartner.ts", import.meta.url),
  "utf8",
)

const application = {
  name: "Alex",
  email: "shop@tideshop.com",
  shopName: "Tide Shop",
  city: "Santa Barbara, CA",
  website: "instagram.com/tideshop",
  boardCount: "10",
  message: "We have trade-ins ready.",
}

describe("buildSurfShopPartnerCustomerMessage", () => {
  it("includes what the shop submitted and omits ops waiver steps", () => {
    const body = buildSurfShopPartnerCustomerMessage(application)
    assert.match(body, /Tide Shop/)
    assert.match(body, /shop@tideshop.com/)
    assert.match(body, /We have trade-ins ready/)
    assert.equal(body.includes(SURF_SHOP_PARTNER_OPS_NOTE), false)
    assert.equal(body.includes("is_reswell_seller"), false)
    assert.equal(body.includes("Ops:"), false)
  })
})

describe("buildSurfShopPartnerOpsNotes", () => {
  it("keeps the waiver grant instruction for staff", () => {
    assert.match(buildSurfShopPartnerOpsNotes(), /is_reswell_seller/)
  })

  it("notes a signed-in account when work email differs", () => {
    const notes = buildSurfShopPartnerOpsNotes({
      sessionEmail: "alex@gmail.com",
      workEmail: "shop@tideshop.com",
    })
    assert.match(notes, /alex@gmail.com/)
    assert.match(notes, /shop@tideshop.com/)
    assert.match(notes, /not by work email/)
  })
})

describe("surfShopPartnerLinkedUserId", () => {
  it("links the signed-in member even when work email differs", () => {
    assert.equal(surfShopPartnerLinkedUserId({ id: "user-1" }), "user-1")
  })

  it("does not resolve a member from work email alone", () => {
    assert.equal(surfShopPartnerLinkedUserId(null), null)
    assert.equal(surfShopPartnerLinkedUserId({ id: "   " }), null)
    assert.equal(surfShopPartnerLinkedUserId({}), null)
  })
})

describe("submitSurfShopPartnerApplicationService wiring", () => {
  it("keeps ops notes off the customer opening message, member thread, and Klaviyo message", () => {
    assert.match(serviceSource, /message: customerMessage/)
    assert.match(serviceSource, /body: customerMessage/)
    assert.match(serviceSource, /internal_notes: opsNotes/)
    assert.match(serviceSource, /trackKlaviyoSupportTicketCreated/)
    assert.doesNotMatch(serviceSource, /body: message/)
    assert.doesNotMatch(serviceSource, /findUserIdsByEmails/)
    assert.doesNotMatch(serviceSource, /trackKlaviyoOrderShipped/)
  })

  it("links the session user without requiring work email to match", () => {
    assert.match(serviceSource, /surfShopPartnerLinkedUserId\(user\)/)
    assert.doesNotMatch(
      serviceSource,
      /user\.email[\s\S]{0,80}=== email/,
    )
  })
})
