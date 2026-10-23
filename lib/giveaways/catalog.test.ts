import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { BUSINESS_TIMEZONE } from "@/lib/utils/business-timezone"
import {
  formatGiveawayEndDate,
  getGiveawayBySlug,
  isGiveawayOpen,
  listCurrentGiveaways,
  SURFBOARD_GIVEAWAY_CAMPAIGN_ENABLED,
  WIN_A_SURFBOARD_GIVEAWAY_SLUG,
} from "./catalog.ts"

describe("custom surfboard giveaway is shut off", () => {
  const giveaway = getGiveawayBySlug(WIN_A_SURFBOARD_GIVEAWAY_SLUG)

  it("keeps the recorded close at 11:59pm Pacific on October 7, 2026", () => {
    assert.ok(giveaway)
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: BUSINESS_TIMEZONE,
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(giveaway.endsAt))
    assert.equal(formatted, "October 7, 2026 at 11:59 PM PDT")
    assert.equal(formatGiveawayEndDate(giveaway.endsAt), "October 7, 2026")
  })

  it("does not accept entries or show the raffle, including before the old deadline", () => {
    assert.equal(SURFBOARD_GIVEAWAY_CAMPAIGN_ENABLED, false)
    assert.ok(giveaway)
    assert.equal(giveaway.status, "ended")
    assert.equal(isGiveawayOpen(giveaway, Date.parse("2026-10-07T20:00:00.000Z")), false)
    assert.equal(isGiveawayOpen(giveaway, Date.parse("2026-10-08T06:59:59.000Z")), false)
    assert.deepEqual(listCurrentGiveaways(Date.parse("2026-10-07T20:00:00.000Z")), [])
  })
})
