import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { CARRIER_DELIVERY_PAYOUT_HOLD_DAYS } from "@/lib/shipping/carrier-delivery-payout-timing"
import {
  listingSavedDedupeKey,
  listingSavedDigestDedupeKey,
  newListingDedupeKey,
  notificationDayKey,
  orderDeliveredBuyerBody,
  orderDeliveredBuyerTitle,
  orderDeliveredDedupeKey,
  orderDeliveredPayoutDedupeKey,
  orderDeliveredSellerPayoutAvailableBody,
  orderDeliveredSellerPayoutSoonBody,
  orderDeliveredSellerTitle,
  orderPickedUpBuyerBody,
  orderPickedUpSellerBody,
  priceDropDedupeKey,
  priceDropMeetsThreshold,
} from "@/lib/services/notifications/catalog"
import {
  collapsePlannedDeliveries,
  planInAppNotifications,
  planPairKey,
  type InAppNotificationInput,
  type NotificationPlanSnapshot,
} from "@/lib/services/notifications/plan"

const NOW = new Date("2026-10-21T18:00:00.000Z")
const DAY = notificationDayKey(NOW)
const SELLER = "seller-1"
const BUYER = "buyer-1"
const OTHER = "buyer-2"

function snapshot(patch: Partial<NotificationPlanSnapshot> = {}): NotificationPlanSnapshot {
  return {
    now: NOW,
    followInAppOptOut: new Set(),
    existing: new Map(),
    seenLogKeys: new Set(),
    deliveredInWindow: new Map(),
    digestedCounts: new Map(),
    ...patch,
  }
}

function saved(actorId: string, listingId: string): InAppNotificationInput {
  return {
    userId: SELLER,
    type: "listing_saved",
    actorId,
    listingId,
    title: "Someone saved your listing",
    body: `Someone saved your item: Board ${listingId}`,
    href: `/l/${listingId}`,
    dedupeKey: listingSavedDedupeKey(listingId, actorId, DAY),
  }
}

function followedListing(followerId: string, listingId: string, sellerId = SELLER): InAppNotificationInput {
  return {
    userId: followerId,
    type: "new_listing_from_followed",
    actorId: sellerId,
    listingId,
    subjectKey: sellerId,
    digestActorName: "North Shore",
    title: "New listing",
    body: `New listing: Board ${listingId}`,
    href: `/l/${listingId}`,
    dedupeKey: newListingDedupeKey(listingId),
  }
}

function priceDrop(listingId: string): InAppNotificationInput {
  return {
    userId: BUYER,
    type: "price_drop_from_followed",
    actorId: SELLER,
    listingId,
    title: "Price drop",
    body: `Price drop on "Board ${listingId}"`,
    href: `/l/${listingId}`,
    dedupeKey: priceDropDedupeKey(listingId),
  }
}

describe("priceDropMeetsThreshold", () => {
  it("accepts a drop of at least 10 percent", () => {
    assert.equal(priceDropMeetsThreshold(100, 90), true)
    assert.equal(priceDropMeetsThreshold(100, 89), true)
  })

  it("rejects a smaller drop, a raise, and a non-positive original price", () => {
    assert.equal(priceDropMeetsThreshold(100, 91), false)
    assert.equal(priceDropMeetsThreshold(100, 100), false)
    assert.equal(priceDropMeetsThreshold(100, 120), false)
    assert.equal(priceDropMeetsThreshold(0, -1), false)
  })
})

describe("planInAppNotifications", () => {
  it("sends listing saves under the daily cap and folds the rest into one digest", () => {
    const inputs = Array.from({ length: 12 }, (_, index) => saved(`actor-${index}`, `listing-${index}`))
    const planned = planInAppNotifications(inputs, snapshot())
    const delivered = planned.filter((item) => item.action === "deliver")

    assert.equal(delivered.length, 12)
    assert.equal(delivered.filter((item) => item.row.type === "listing_saved").length, 10)
    const digests = delivered.filter((item) => item.row.type === "listing_saved_digest")
    assert.equal(digests.length, 2)
    assert.equal(digests[0]?.row.body, "1 more person saved your listings today.")
    assert.equal(digests[1]?.row.body, "2 more people saved your listings today.")
    assert.equal(digests[1]?.row.dedupeKey, listingSavedDigestDedupeKey(DAY))
    assert.equal(digests[1]?.logOutcome, "digested")

    const collapsed = collapsePlannedDeliveries(planned)
    assert.equal(collapsed.rows.filter((row) => row.row.type === "listing_saved_digest").length, 1)
    assert.equal(collapsed.rows.find((row) => row.row.type === "listing_saved_digest")?.row.metadata.count, 2)
    assert.equal(collapsed.logs.filter((log) => log.outcome === "digested").length, 2)
  })

  it("does not count the same save twice in one day", () => {
    const first = saved(BUYER, "listing-1")
    const planned = planInAppNotifications(
      [first],
      snapshot({
        seenLogKeys: new Set([planPairKey(SELLER, first.dedupeKey)]),
      }),
    )
    assert.equal(planned[0]?.action, "skip")
    if (planned[0]?.action === "skip") assert.equal(planned[0].reason, "duplicate")
  })

  it("skips a save of your own listing", () => {
    const planned = planInAppNotifications([saved(SELLER, "listing-1")], snapshot())
    assert.equal(planned[0]?.action, "skip")
    if (planned[0]?.action === "skip") assert.equal(planned[0].reason, "self")
  })

  it("sends each followed listing on its own without a digest", () => {
    const inputs = [
      ...Array.from({ length: 4 }, (_, index) => followedListing(BUYER, `a-${index}`, "shop-a")),
      ...Array.from({ length: 7 }, (_, index) => followedListing(BUYER, `b-${index}`, "shop-b")),
    ]
    const planned = planInAppNotifications(inputs, snapshot())
    const individuals = planned.filter(
      (item) => item.action === "deliver" && item.row.type === "new_listing_from_followed",
    )
    const digests = planned.filter(
      (item) => item.action === "deliver" && item.row.type === "new_listing_from_followed_digest",
    )

    assert.equal(individuals.length, 11)
    assert.equal(digests.length, 0)
    assert.equal(
      individuals.filter((item) => item.action === "deliver" && item.subjectKey === "shop-a").length,
      4,
    )
  })

  it("does not fold a new listing into a digest when older rows already filled a window", () => {
    const inputs = Array.from({ length: 3 }, (_, seller) =>
      followedListing(BUYER, `shop-${seller}`, `shop-${seller}`),
    )
    const planned = planInAppNotifications(inputs, snapshot({
      deliveredInWindow: new Map([
        [
          planPairKey(BUYER, "new_listing_from_followed"),
          {
            count: 8,
            keys: new Set(["already-1", "already-2"]),
            subjectCounts: new Map([["shop-0", 2]]),
          },
        ],
      ]),
    }))

    assert.equal(
      planned.every((item) => item.action === "deliver" && item.row.type === "new_listing_from_followed"),
      true,
    )
  })

  it("does not send the same followed listing twice", () => {
    const input = followedListing(BUYER, "listing-9", "shop-a")
    const planned = planInAppNotifications(
      [input, input],
      snapshot({
        seenLogKeys: new Set([planPairKey(BUYER, input.dedupeKey)]),
      }),
    )

    assert.equal(planned[0]?.action, "skip")
    assert.equal(planned[1]?.action, "skip")
    if (planned[0]?.action === "skip") assert.equal(planned[0].reason, "duplicate")
  })

  it("respects the in-app follow preference for follow events only", () => {
    const planned = planInAppNotifications(
      [followedListing(BUYER, "listing-1"), saved(OTHER, "listing-2"), priceDrop("listing-3")],
      snapshot({ followInAppOptOut: new Set([BUYER]) }),
    )
    assert.equal(planned[0]?.action, "skip")
    if (planned[0]?.action === "skip") assert.equal(planned[0].reason, "preference")
    assert.equal(planned[1]?.action, "deliver")
    assert.equal(planned[2]?.action, "skip")
  })

  it("updates an open price drop without spending another daily slot", () => {
    const first = priceDrop("listing-1")
    const planned = planInAppNotifications(
      [first, priceDrop("listing-6")],
      snapshot({
        existing: new Map([[planPairKey(BUYER, first.dedupeKey), { isRead: false }]]),
        deliveredInWindow: new Map([
          [
            planPairKey(BUYER, "price_drop_from_followed"),
            { count: 5, keys: new Set(["other-1", "other-2", "other-3", "other-4", "other-5"]), subjectCounts: new Map() },
          ],
        ]),
      }),
    )

    assert.equal(planned[0]?.action, "deliver")
    if (planned[0]?.action === "deliver") assert.equal(planned[0].recordLog, false)
    assert.equal(planned[1]?.action, "skip")
    if (planned[1]?.action === "skip") assert.equal(planned[1].reason, "cap")
  })

  it("sends a price drop again the next window after it was read", () => {
    const input = priceDrop("listing-1")
    const planned = planInAppNotifications(
      [input],
      snapshot({
        existing: new Map([[planPairKey(BUYER, input.dedupeKey), { isRead: true }]]),
      }),
    )
    assert.equal(planned[0]?.action, "deliver")
    if (planned[0]?.action === "deliver") assert.equal(planned[0].recordLog, true)
  })

  it("sends an offer once per recipient and event key", () => {
    const input: InAppNotificationInput = {
      userId: SELLER,
      type: "offer_received",
      actorId: BUYER,
      listingId: "listing-1",
      title: "New offer",
      body: "New offer of $400.00 on Board",
      dedupeKey: "offer_received:offer-1",
    }
    const first = planInAppNotifications([input], snapshot())
    const second = planInAppNotifications(
      [input],
      snapshot({ seenLogKeys: new Set([planPairKey(SELLER, input.dedupeKey)]) }),
    )
    assert.equal(first[0]?.action, "deliver")
    assert.equal(second[0]?.action, "skip")
    if (second[0]?.action === "skip") assert.equal(second[0].reason, "duplicate")
  })
})

describe("order delivered copy", () => {
  it("tells the buyer the order arrived and the seller when payout starts", () => {
    assert.equal(orderDeliveredBuyerTitle(), "Your order was delivered")
    assert.equal(orderDeliveredBuyerBody("1042"), "Your order #1042 was delivered.")
    assert.equal(orderDeliveredSellerTitle(), "Order delivered")
    assert.equal(
      orderDeliveredSellerPayoutSoonBody("1042"),
      `Order #1042 was delivered. Your payout will be available in ${CARRIER_DELIVERY_PAYOUT_HOLD_DAYS} days.`,
    )
    assert.equal(CARRIER_DELIVERY_PAYOUT_HOLD_DAYS, 4)
    assert.equal(
      orderDeliveredSellerPayoutAvailableBody("1042"),
      "Order #1042 was delivered. Your payout is available.",
    )
    assert.equal(orderPickedUpBuyerBody("1042"), "Your order #1042 was picked up.")
    assert.equal(
      orderPickedUpSellerBody("1042"),
      "Order #1042 was picked up. Your payout is available.",
    )
  })

  it("sends delivery once per order even when follow notices are off", () => {
    const buyer: InAppNotificationInput = {
      userId: BUYER,
      type: "order_delivered",
      listingId: "listing-1",
      title: orderDeliveredBuyerTitle(),
      body: orderDeliveredBuyerBody("1042"),
      href: "/dashboard/purchases/order-1",
      dedupeKey: orderDeliveredDedupeKey("order-1"),
    }
    const seller: InAppNotificationInput = {
      userId: SELLER,
      type: "order_delivered_payout",
      listingId: "listing-1",
      title: orderDeliveredSellerTitle(),
      body: orderDeliveredSellerPayoutSoonBody("1042"),
      href: "/dashboard/sales/order-1",
      dedupeKey: orderDeliveredPayoutDedupeKey("order-1"),
    }
    const first = planInAppNotifications(
      [buyer, seller],
      snapshot({ followInAppOptOut: new Set([BUYER, SELLER]) }),
    )
    const second = planInAppNotifications(
      [
        { ...buyer, body: orderDeliveredBuyerBody("1042") },
        { ...seller, body: orderDeliveredSellerPayoutAvailableBody("1042") },
      ],
      snapshot({
        seenLogKeys: new Set([
          planPairKey(BUYER, buyer.dedupeKey),
          planPairKey(SELLER, seller.dedupeKey),
        ]),
      }),
    )

    assert.equal(first.length, 2)
    assert.equal(first[0]?.action, "deliver")
    assert.equal(first[1]?.action, "deliver")
    if (first[1]?.action === "deliver") {
      assert.equal(
        first[1].row.body,
        `Order #1042 was delivered. Your payout will be available in ${CARRIER_DELIVERY_PAYOUT_HOLD_DAYS} days.`,
      )
    }
    assert.equal(second[0]?.action, "skip")
    assert.equal(second[1]?.action, "skip")
    if (second[0]?.action === "skip") assert.equal(second[0].reason, "duplicate")
    if (second[1]?.action === "skip") assert.equal(second[1].reason, "duplicate")
  })
})
