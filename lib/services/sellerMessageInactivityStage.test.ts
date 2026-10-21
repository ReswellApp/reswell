import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  sellerListingAutoHiddenBody,
  sellerListingHideWarningBody,
  sellerMessageWaitingBody,
} from "@/lib/services/notifications/catalog"
import {
  resolveSellerMessageReminderStage,
  sellerMessageReminderMessageKey,
} from "@/lib/services/sellerMessageInactivityStage"
import { activityKindLabel } from "@/lib/utils/messages-inbox-activity"

const REFERENCE = new Date("2026-10-21T07:00:00.000Z")

function atDaysAgo(days: number, extraMs = 0): Date {
  return new Date(REFERENCE.getTime() - days * 24 * 60 * 60 * 1000 - extraMs)
}

describe("resolveSellerMessageReminderStage", () => {
  it("stays quiet until the message is strictly older than 3 days", () => {
    assert.equal(
      resolveSellerMessageReminderStage({
        buyerMessageAt: atDaysAgo(3),
        referenceTime: REFERENCE,
        reminder3dAt: null,
        warning6dAt: null,
        vacationAppliedAt: null,
      }),
      null,
    )
    assert.equal(
      resolveSellerMessageReminderStage({
        buyerMessageAt: atDaysAgo(3, 1),
        referenceTime: REFERENCE,
        reminder3dAt: null,
        warning6dAt: null,
        vacationAppliedAt: null,
      }),
      "day3",
    )
  })

  it("warns on day 6 even if the day-3 reminder was missed", () => {
    assert.equal(
      resolveSellerMessageReminderStage({
        buyerMessageAt: atDaysAgo(6, 1),
        referenceTime: REFERENCE,
        reminder3dAt: null,
        warning6dAt: null,
        vacationAppliedAt: null,
      }),
      "day6",
    )
  })

  it("sends the day-6 warning once, then waits for day 7", () => {
    assert.equal(
      resolveSellerMessageReminderStage({
        buyerMessageAt: atDaysAgo(6, 1),
        referenceTime: REFERENCE,
        reminder3dAt: "2026-10-18T07:00:00.000Z",
        warning6dAt: null,
        vacationAppliedAt: null,
      }),
      "day6",
    )
    assert.equal(
      resolveSellerMessageReminderStage({
        buyerMessageAt: atDaysAgo(6, 1),
        referenceTime: REFERENCE,
        reminder3dAt: "2026-10-18T07:00:00.000Z",
        warning6dAt: "2026-10-21T07:00:00.000Z",
        vacationAppliedAt: null,
      }),
      null,
    )
  })

  it("hides on day 7 even when the earlier reminders were missed", () => {
    assert.equal(
      resolveSellerMessageReminderStage({
        buyerMessageAt: atDaysAgo(7, 1),
        referenceTime: REFERENCE,
        reminder3dAt: null,
        warning6dAt: null,
        vacationAppliedAt: null,
      }),
      "day7",
    )
  })

  it("does not remind a message that already hid the listing", () => {
    assert.equal(
      resolveSellerMessageReminderStage({
        buyerMessageAt: atDaysAgo(8),
        referenceTime: REFERENCE,
        reminder3dAt: null,
        warning6dAt: null,
        vacationAppliedAt: "2026-10-20T07:00:00.000Z",
      }),
      null,
    )
  })
})

describe("seller unanswered notice copy", () => {
  it("uses the still-here, hide-warning, and hidden sentences", () => {
    assert.match(sellerMessageWaitingBody("Bunny Chow"), /Are you still here\?/)
    assert.match(sellerMessageWaitingBody("Bunny Chow"), /never responded/)
    assert.match(sellerListingHideWarningBody("Bunny Chow"), /vacation mode \(hidden\)/)
    assert.match(sellerListingHideWarningBody("Bunny Chow"), /still have this listing/)
    assert.match(sellerListingHideWarningBody("Bunny Chow"), /turn it back on whenever you like/)
    assert.match(sellerListingAutoHiddenBody("Bunny Chow"), /Bunny Chow is in vacation mode \(hidden\)/)
    assert.match(sellerListingAutoHiddenBody("Bunny Chow"), /turn it back on whenever you like/)
    assert.equal(activityKindLabel("seller_message_waiting"), "Reply")
    assert.equal(activityKindLabel("seller_listing_hide_warning"), "Vacation")
    assert.equal(activityKindLabel("seller_listing_auto_hidden"), "Vacation")
    assert.equal(sellerMessageReminderMessageKey(["b", "a"]), "a,b")
  })
})
