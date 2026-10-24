import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { KLAVIYO_FOLLOWED_SELLER_NEW_LISTING_EMAIL_HTML } from "@/lib/klaviyo/followed-seller-new-listing-email-liquid"
import {
  FOLLOWED_SELLER_NEW_LISTING_DAILY_CAP,
  NOTIFICATION_POLICIES,
  newListingBody,
  newListingTitle,
} from "@/lib/services/notifications/catalog"
import {
  followedSellerNewListingAlertMaySend,
  followedSellerNewListingDayKey,
  recipientsAllowedByListingAlertCap,
} from "@/lib/services/followedSellerNewListingCap"

describe("followed seller new listing day", () => {
  it("uses the America/Los_Angeles calendar day, including the daylight-saving boundary", () => {
    assert.equal(followedSellerNewListingDayKey(new Date("2026-10-22T06:59:00.000Z")), "2026-10-21")
    assert.equal(followedSellerNewListingDayKey(new Date("2026-10-22T07:00:00.000Z")), "2026-10-22")
    assert.equal(followedSellerNewListingDayKey(new Date("2026-12-22T07:59:00.000Z")), "2026-12-21")
    assert.equal(followedSellerNewListingDayKey(new Date("2026-12-22T08:00:00.000Z")), "2026-12-22")
  })
})

describe("followed seller new listing copy", () => {
  it("reads like a shop just posted, with the title and price", () => {
    assert.equal(newListingTitle("North Shore"), "North Shore just posted")
    assert.equal(
      newListingBody("North Shore", "6'2 Twinzer", 650),
      "North Shore just posted 6'2 Twinzer for $650.00.",
    )
    assert.equal(newListingBody("  ", "", null), "A shop you follow just posted a new listing.")
  })
})

describe("followed seller new listing cap", () => {
  it("sends the first grants and a retry, and holds the third", () => {
    assert.equal(FOLLOWED_SELLER_NEW_LISTING_DAILY_CAP, 2)
    assert.equal(NOTIFICATION_POLICIES.new_listing_from_followed.mode, "once")
    assert.equal(NOTIFICATION_POLICIES.new_listing_from_followed.digestType, undefined)
    assert.equal(NOTIFICATION_POLICIES.new_listing_from_followed.preference, "follow_in_app")

    const allowed = recipientsAllowedByListingAlertCap([
      { recipientId: "a", status: "granted" },
      { recipientId: "b", status: "already_granted" },
      { recipientId: "c", status: "capped" },
    ])
    assert.equal(followedSellerNewListingAlertMaySend("granted"), true)
    assert.equal(followedSellerNewListingAlertMaySend("already_granted"), true)
    assert.equal(followedSellerNewListingAlertMaySend("capped"), false)
    assert.deepEqual([...allowed].sort(), ["a", "b"])
  })

  it("keeps the database claim at two per follower, locked, and idempotent per listing", () => {
    const sql = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../supabase/migrations/20271105120000_followed_seller_new_listing_daily_cap.sql",
      ),
      "utf8",
    )
    assert.match(sql, /v_cap constant integer := 2/)
    assert.match(sql, /PRIMARY KEY \(recipient_id, listing_id\)/)
    assert.match(sql, /pg_advisory_xact_lock/)
    assert.match(sql, /status := 'capped'/)
    assert.match(sql, /status := 'already_granted'/)
    assert.doesNotMatch(sql, /GRANT EXECUTE[\s\S]*TO authenticated/)
  })
})

describe("followed seller new listing email html", () => {
  it("is paste-ready and names the shop, title, price, photo, and listing link", () => {
    const html = KLAVIYO_FOLLOWED_SELLER_NEW_LISTING_EMAIL_HTML
    assert.match(html, /shop_display_name/)
    assert.match(html, /event\|lookup:'Title'/)
    assert.match(html, /price_display/)
    assert.match(html, /photo_url/)
    assert.match(html, /Listing_URL/)
    assert.match(html, /following_feed_url/)
    assert.match(html, /just posted/)
    assert.equal(html.includes("{%"), false)
  })
})
