import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { sellerMessageWaitingBody } from "@/lib/services/notifications/catalog"
import {
  resolveSellerMessageReminderStage,
  sellerMessageReminderMessageKey,
} from "@/lib/services/sellerMessageInactivityStage"
import { activityKindLabel } from "@/lib/utils/messages-inbox-activity"

const REFERENCE = new Date("2026-10-21T07:00:00.000Z")

function atDaysAgo(days: number, extraMs = 0): Date {
  return new Date(REFERENCE.getTime() - days * 24 * 60 * 60 * 1000 - extraMs)
}

const unsetMilestones = {
  reminder3dAt: null,
  warning6dAt: null,
  vacationAppliedAt: null,
} as const

describe("resolveSellerMessageReminderStage", () => {
  it("stays quiet until the message is strictly older than 3 days", () => {
    assert.equal(
      resolveSellerMessageReminderStage({
        buyerMessageAt: atDaysAgo(3),
        referenceTime: REFERENCE,
        ...unsetMilestones,
      }),
      null,
    )
    assert.equal(
      resolveSellerMessageReminderStage({
        buyerMessageAt: atDaysAgo(3, 1),
        referenceTime: REFERENCE,
        ...unsetMilestones,
      }),
      "day3",
    )
  })

  it("still sends the day-3 reminder when earlier hide milestones were skipped", () => {
    assert.equal(
      resolveSellerMessageReminderStage({
        buyerMessageAt: atDaysAgo(6, 1),
        referenceTime: REFERENCE,
        ...unsetMilestones,
      }),
      "day3",
    )
    assert.equal(
      resolveSellerMessageReminderStage({
        buyerMessageAt: atDaysAgo(7, 1),
        referenceTime: REFERENCE,
        ...unsetMilestones,
      }),
      "day3",
    )
  })

  it("does not auto-hide or warn after day 3 has already been sent", () => {
    assert.equal(
      resolveSellerMessageReminderStage({
        buyerMessageAt: atDaysAgo(6, 1),
        referenceTime: REFERENCE,
        reminder3dAt: "2026-10-18T07:00:00.000Z",
        warning6dAt: null,
        vacationAppliedAt: null,
      }),
      null,
    )
    assert.equal(
      resolveSellerMessageReminderStage({
        buyerMessageAt: atDaysAgo(7, 1),
        referenceTime: REFERENCE,
        reminder3dAt: "2026-10-18T07:00:00.000Z",
        warning6dAt: null,
        vacationAppliedAt: null,
      }),
      null,
    )
  })

  it("does not remind a message that already got a hide warning or auto vacation", () => {
    assert.equal(
      resolveSellerMessageReminderStage({
        buyerMessageAt: atDaysAgo(6, 1),
        referenceTime: REFERENCE,
        reminder3dAt: null,
        warning6dAt: "2026-10-21T07:00:00.000Z",
        vacationAppliedAt: null,
      }),
      null,
    )
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
  it("uses the still-here reminder", () => {
    assert.match(sellerMessageWaitingBody("Bunny Chow"), /Are you still here\?/)
    assert.match(sellerMessageWaitingBody("Bunny Chow"), /never responded/)
    assert.equal(activityKindLabel("seller_message_waiting"), "Reply")
    assert.equal(sellerMessageReminderMessageKey(["b", "a"]), "a,b")
  })
})
