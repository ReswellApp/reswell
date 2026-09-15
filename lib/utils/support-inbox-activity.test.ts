import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { MessagesInboxNotification } from "../db/messagesInbox.ts"
import {
  isSupportActivityType,
  mergeInboxActivityNotifications,
  supportCaseToInboxNotification,
} from "./support-inbox-activity.ts"

function favoriteNote(overrides: Partial<MessagesInboxNotification> = {}): MessagesInboxNotification {
  return {
    id: "fav-1",
    type: "listing_saved",
    listing_id: "listing-1",
    actor_id: null,
    message: "Someone saved your item",
    is_read: true,
    created_at: "2026-09-14T12:00:00.000Z",
    listings: null,
    ...overrides,
  }
}

describe("support inbox activity", () => {
  it("maps a Reswell reply onto the activity shape", () => {
    const item = supportCaseToInboxNotification({
      id: "11111111-1111-4111-8111-111111111111",
      subject: "[Seller] Order help · YY3WN3",
      unreadCount: 1,
      latestAgentAt: "2026-09-15T16:00:00.000Z",
    })
    assert.equal(isSupportActivityType(item.type), true)
    assert.equal(item.support_subject, "Order help · YY3WN3")
    assert.equal(item.is_read, false)
    assert.equal(item.support_case_id, "11111111-1111-4111-8111-111111111111")
    assert.equal(item.message, "Reswell replied to your request")
  })

  it("merges support replies ahead of older favorites", () => {
    const support = supportCaseToInboxNotification({
      id: "case-1",
      subject: "Payments",
      unreadCount: 2,
      latestAgentAt: "2026-09-15T18:00:00.000Z",
    })
    const merged = mergeInboxActivityNotifications([favoriteNote()], [support])
    assert.equal(merged[0]?.id, "support:case-1")
    assert.equal(merged.length, 2)
  })
})
