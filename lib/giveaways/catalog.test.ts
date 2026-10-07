import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { BUSINESS_TIMEZONE } from "@/lib/utils/business-timezone"
import {
  formatGiveawayEndDate,
  getGiveawayBySlug,
  isGiveawayOpen,
  WIN_A_SURFBOARD_ENTRY_DEADLINE_COPY,
  WIN_A_SURFBOARD_GIVEAWAY_SLUG,
} from "./catalog.ts"

describe("custom surfboard entry deadline", () => {
  const giveaway = getGiveawayBySlug(WIN_A_SURFBOARD_GIVEAWAY_SLUG)

  it("closes at 11:59pm Pacific on October 7, 2026", () => {
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

  it("stays open through 11:59pm Pacific and closes at midnight", () => {
    assert.ok(giveaway)
    assert.equal(isGiveawayOpen(giveaway, Date.parse("2026-10-08T06:59:59.000Z")), true)
    assert.equal(isGiveawayOpen(giveaway, Date.parse("2026-10-08T07:00:00.000Z")), false)
  })

  it("shows tonight at 11:59pm PT on the giveaway page copy", () => {
    assert.ok(giveaway)
    assert.equal(giveaway.deadlineLabel, WIN_A_SURFBOARD_ENTRY_DEADLINE_COPY)
    assert.match(giveaway.scheduleLabel, /tonight at 11:59pm PT/)
    assert.match(giveaway.howItWorks[1]?.body ?? "", /tonight at 11:59pm PT/)
    assert.ok(giveaway.rules.some((rule) => rule.includes("tonight at 11:59pm PT")))
  })
})
