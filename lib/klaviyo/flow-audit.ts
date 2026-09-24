/**
 * Code-side audit of Klaviyo triggers.
 *
 * Live flow status (draft vs sending) still comes from the Klaviyo Flows API
 * on the Email flows tab. This module answers three questions from what the
 * app actually emits:
 * - which triggers fire but must not also send an email
 * - which triggers are the same moment twice
 * - which marketplace flows to build (Reverb, eBay, PangoBooks patterns)
 */

import { KNOWN_KLAVIYO_METRIC_NAMES } from "@/lib/klaviyo/event-log-shared"
import {
  COUNTEROFFER_DECLINED_METRIC,
  INTELLIGENCE_REPORT_METRIC_NAME,
  OFFER_DECLINED_METRIC,
  OFFER_EXPIRING_METRIC,
  PICKUP_REMINDER_METRIC,
  SELLER_SHIP_REMINDER_METRIC,
  SOLD_SALE_FEEDBACK_METRIC,
  VIEWED_LISTING_METRIC,
} from "@/lib/klaviyo/marketplace-metrics"

export type KlaviyoFlowAuditDisposition =
  | "customer_email"
  | "companion_no_email"
  | "too_broad"
  | "ops_only"

export interface KlaviyoDuplicateGroup {
  id: string
  title: string
  emailThese: string[]
  doNotAlsoEmail: string[]
  why: string
}

export interface KlaviyoFlowCaution {
  title: string
  detail: string
}

export interface KlaviyoRecommendedFlow {
  id: string
  kind: "transactional" | "marketing" | "winback"
  peer: string
  metric: string
  who: string
  when: string
  exit: string
  status: "build_on_existing" | "new_metric"
}

const COMPANION_NO_EMAIL = new Set<string>(["Placed Order", "New Sale Received"])

const TOO_BROAD = new Set<string>(["Viewed Site Page", "Viewed Boards Page"])

const OPS_ONLY = new Set<string>([
  "Search Insights Digest",
  "Platform Error Digest",
  "Inactive Sync Report",
  INTELLIGENCE_REPORT_METRIC_NAME,
  SOLD_SALE_FEEDBACK_METRIC,
])

export function klaviyoMetricFlowDisposition(metric: string): KlaviyoFlowAuditDisposition {
  if (OPS_ONLY.has(metric)) return "ops_only"
  if (TOO_BROAD.has(metric)) return "too_broad"
  if (COMPANION_NO_EMAIL.has(metric)) return "companion_no_email"
  return "customer_email"
}

export const KLAVIYO_DUPLICATE_GROUPS: KlaviyoDuplicateGroup[] = [
  {
    id: "buyer-receipt",
    title: "Buyer checkout receipt",
    emailThese: ["Purchase Successful", "Local Pickup Order Placed"],
    doNotAlsoEmail: ["Placed Order"],
    why: "Every paid checkout emits Purchase Successful and Placed Order together. Pickup checkouts also emit Local Pickup Order Placed. Placed Order is the commerce metric for revenue and for suppressing abandoned cart and checkout. Email Purchase Successful only when fulfillment_method is shipping. Email Local Pickup Order Placed for pickup. A second email on Placed Order, or Purchase Successful without the shipping filter, sends two receipts.",
  },
  {
    id: "seller-new-sale",
    title: "Seller new-sale alert",
    emailThese: ["Shipping Sale Received", "Local Pickup Sale Received"],
    doNotAlsoEmail: ["New Sale Received"],
    why: "Checkout emits New Sale Received and then the fulfillment-specific metric to the same seller. Email Shipping Sale Received or Local Pickup Sale Received. Leave New Sale Received off, or the seller gets two sale alerts.",
  },
  {
    id: "browse",
    title: "Browse vs product view",
    emailThese: [VIEWED_LISTING_METRIC],
    doNotAlsoEmail: ["Viewed Site Page", "Viewed Boards Page"],
    why: "Viewed Site Page fires on almost every non-board, non-sell URL, so it is active and not usable as a product email. Viewed Boards Page is the catalog, not one board. Listing pages (/l/…) now emit Viewed Listing with product fields. That is the browse-abandonment trigger.",
  },
]

export const KLAVIYO_FLOW_CAUTIONS: KlaviyoFlowCaution[] = [
  {
    title: "Listing and First Time Seller",
    detail:
      "The first publish in a category emits Listing and First Time Seller - {section} (boards also emit the shipping or pickup variant). Use Listing for the immediate “your listing is live” email and as the exit on the Viewed Sell Page flow. Use First Time Seller as a delayed onboarding series, not a second immediate live email.",
  },
  {
    title: "Two review asks",
    detail:
      "Review Invite Sent is the automatic post-purchase and post-delivery ask. Review Requested fires when the seller asks from Messages. Email both, and on Review Requested skip profiles who already received Review Invite Sent in the last 7 days.",
  },
  {
    title: "Delivered is already Order Shipping Update",
    detail:
      "Carrier delivered, out for delivery, and exceptions are Order Shipping Update (is_delivered, sms_milestone). Split that flow. Do not add a second delivered metric or buyers get two arrival emails. Sale Successful is later — seller earnings released — not a second receipt.",
  },
  {
    title: "Accepted-offer reminder already exists",
    detail:
      "Offer Accepted should email immediately, then again after 24 hours (offer-accepted-reminder-email.html), and exit on Placed Order or Purchase Successful. Offer Expiring does not fire for ACCEPTED offers, so it does not stack on that reminder.",
  },
  {
    title: "Favorites and follows are two people",
    detail:
      "Listing Saved emails the buyer. Favorites button emails the seller. Shop Followed emails the seller. Following Shop emails the follower. Those pairs are not duplicates. Filter is_backfill is not true on the follow metrics.",
  },
]

export const KLAVIYO_RECOMMENDED_FLOWS: KlaviyoRecommendedFlow[] = [
  {
    id: "order-receipt-ship",
    kind: "transactional",
    peer: "Reverb, eBay, PangoBooks order confirmation",
    metric: "Purchase Successful",
    who: "Buyer",
    when: "Immediately. Filter fulfillment_method equals shipping.",
    exit: "None. One email per order (unique checkout).",
    status: "build_on_existing",
  },
  {
    id: "order-receipt-pickup",
    kind: "transactional",
    peer: "Reverb local pickup instructions",
    metric: "Local Pickup Order Placed",
    who: "Buyer",
    when: "Immediately. Includes pickup_code.",
    exit: "Do not also send Purchase Successful for this order.",
    status: "build_on_existing",
  },
  {
    id: "seller-sale",
    kind: "transactional",
    peer: "eBay sold / PangoBooks you sold a book",
    metric: "Shipping Sale Received",
    who: "Seller",
    when: "Immediately. Pair with a separate flow on Local Pickup Sale Received.",
    exit: "Do not also email New Sale Received.",
    status: "build_on_existing",
  },
  {
    id: "label-ready",
    kind: "transactional",
    peer: "eBay ship-by label",
    metric: "Shipping Label Ready",
    who: "Seller",
    when: "Immediately when Reswell buys the label.",
    exit: "None.",
    status: "build_on_existing",
  },
  {
    id: "shipped",
    kind: "transactional",
    peer: "Reverb, eBay, PangoBooks shipped",
    metric: "Order Shipped",
    who: "Buyer",
    when: "Once, when the order is marked shipped or the first in-transit scan lands.",
    exit: "Seller copy is Seller Order Shipped, a different profile.",
    status: "build_on_existing",
  },
  {
    id: "in-transit",
    kind: "transactional",
    peer: "eBay out for delivery and delivered",
    metric: "Order Shipping Update",
    who: "Buyer",
    when: "On carrier scans. Split email on status. SMS only when sms_milestone is out_for_delivery, delivered, or exception.",
    exit: "Do not send a second email from a different delivered metric.",
    status: "build_on_existing",
  },
  {
    id: "ship-reminder",
    kind: "transactional",
    peer: "eBay please ship",
    metric: SELLER_SHIP_REMINDER_METRIC,
    who: "Seller",
    when: "Once, 48 hours after a confirmed shipping order that is still unshipped.",
    exit: "None beyond the one send. Orders older than 8 days are not nudged.",
    status: "new_metric",
  },
  {
    id: "pickup-reminder",
    kind: "transactional",
    peer: "Reverb ready for pickup",
    metric: PICKUP_REMINDER_METRIC,
    who: "Buyer",
    when: "Once, 48 hours after a confirmed pickup order that is not picked up.",
    exit: "None beyond the one send.",
    status: "new_metric",
  },
  {
    id: "refund",
    kind: "transactional",
    peer: "eBay refund issued",
    metric: "Order Refunded",
    who: "Buyer",
    when: "Immediately.",
    exit: "None.",
    status: "build_on_existing",
  },
  {
    id: "payout",
    kind: "transactional",
    peer: "PangoBooks payout sent",
    metric: "Payouts",
    who: "Seller",
    when: "When a payout is sent. Sale Successful is the earlier “earnings released” moment — email that too, it is not the same event.",
    exit: "None.",
    status: "build_on_existing",
  },
  {
    id: "offer-made",
    kind: "transactional",
    peer: "Reverb, eBay offer received",
    metric: "Offer Made",
    who: "Seller",
    when: "Immediately.",
    exit: "Filter reswell_metric_seed is not true when present.",
    status: "build_on_existing",
  },
  {
    id: "seller-offer",
    kind: "transactional",
    peer: "eBay counteroffer",
    metric: "Seller Made Offer",
    who: "Buyer",
    when: "Immediately when the seller counters or sends an offer.",
    exit: "None.",
    status: "build_on_existing",
  },
  {
    id: "offer-accepted",
    kind: "transactional",
    peer: "eBay offer accepted — complete checkout",
    metric: "Offer Accepted",
    who: "Buyer",
    when: "Immediately, then a 24-hour reminder.",
    exit: "Profile has done Placed Order or Purchase Successful since the flow started.",
    status: "build_on_existing",
  },
  {
    id: "offer-declined",
    kind: "transactional",
    peer: "Reverb, eBay offer declined",
    metric: OFFER_DECLINED_METRIC,
    who: "Buyer",
    when: "Immediately when the seller declines.",
    exit: "None.",
    status: "new_metric",
  },
  {
    id: "counter-declined",
    kind: "transactional",
    peer: "eBay counteroffer declined",
    metric: COUNTEROFFER_DECLINED_METRIC,
    who: "Seller",
    when: "Immediately when the buyer declines the counter.",
    exit: "None.",
    status: "new_metric",
  },
  {
    id: "offer-expiring",
    kind: "transactional",
    peer: "eBay offer expiring",
    metric: OFFER_EXPIRING_METRIC,
    who: "Whoever still has to act (seller on PENDING, buyer on COUNTERED)",
    when: "Once, inside the last 12 hours before expires_at. One template — copy is on the event.",
    exit: "Does not fire for ACCEPTED offers.",
    status: "new_metric",
  },
  {
    id: "message",
    kind: "transactional",
    peer: "Reverb, eBay new message",
    metric: "Message Sent",
    who: "Recipient",
    when: "Immediately.",
    exit: "Skip if they are in the thread. Nested sender fields must not be copied onto the profile email.",
    status: "build_on_existing",
  },
  {
    id: "abandoned-checkout",
    kind: "marketing",
    peer: "Reverb, eBay, PangoBooks abandoned checkout",
    metric: "Checkout Started",
    who: "Buyer",
    when: "Delay 1 hour.",
    exit: "Has done Placed Order or Purchase Successful since starting the flow.",
    status: "build_on_existing",
  },
  {
    id: "abandoned-cart",
    kind: "marketing",
    peer: "eBay cart reminder",
    metric: "Added to Cart",
    who: "Buyer",
    when: "Delay 4 hours.",
    exit: "Has done Checkout Started, Placed Order, or Purchase Successful since starting the flow.",
    status: "build_on_existing",
  },
  {
    id: "browse-abandon",
    kind: "marketing",
    peer: "Reverb viewed listing / eBay still interested",
    metric: VIEWED_LISTING_METRIC,
    who: "Viewer, once the profile has an email",
    when: "Delay 2 hours. Filter listing_status equals active and is_own_listing is not true.",
    exit: "Has done Added to Cart, Checkout Started, Placed Order, or Listing Saved for that product since starting the flow.",
    status: "new_metric",
  },
  {
    id: "price-drop",
    kind: "marketing",
    peer: "Reverb, eBay watched item price drop",
    metric: "Favorite Price Drop",
    who: "Buyer who saved the listing",
    when: "When the price drops.",
    exit: "Listing no longer active — event is only sent for purchasable favorites.",
    status: "build_on_existing",
  },
  {
    id: "saved-search",
    kind: "marketing",
    peer: "eBay saved search / Reverb gear alert",
    metric: "Board Alert Match",
    who: "Buyer",
    when: "When a new listing matches a saved board alert.",
    exit: "None.",
    status: "build_on_existing",
  },
  {
    id: "followed-shop",
    kind: "marketing",
    peer: "Reverb shop you follow listed something",
    metric: "Followed Seller New Listing",
    who: "Follower",
    when: "When a followed shop publishes.",
    exit: "None.",
    status: "build_on_existing",
  },
  {
    id: "favorites-digest",
    kind: "winback",
    peer: "PangoBooks your wishlist is still here",
    metric: "Favorites Digest",
    who: "Buyer",
    when: "Weekly, only if they still have purchasable favorites and have not had this digest in 7 days.",
    exit: "Cron skips empty favorite lists.",
    status: "build_on_existing",
  },
  {
    id: "inactive-30",
    kind: "winback",
    peer: "eBay we miss you / PangoBooks come back",
    metric: "User Inactive 30 Days",
    who: "Account with no sign-in for 30 days",
    when: "Once per lapse. Re-entry is allowed after they return and go quiet again.",
    exit: "Do not stack a second win-back on New Account Created’s 30-day branch for the same week.",
    status: "build_on_existing",
  },
  {
    id: "post-purchase",
    kind: "winback",
    peer: "PangoBooks shop again after you buy",
    metric: "Purchase Successful",
    who: "Buyer",
    when: "A second flow: delay 14 days, recommend browsing. This is not the receipt.",
    exit: "Has done Placed Order since starting this flow (they already bought again).",
    status: "build_on_existing",
  },
  {
    id: "review",
    kind: "winback",
    peer: "eBay leave feedback / Reverb review",
    metric: "Review Invite Sent",
    who: "Buyer",
    when: "Post-purchase and again after delivery.",
    exit: "Buyer already reviewed.",
    status: "build_on_existing",
  },
  {
    id: "sell-abandon",
    kind: "winback",
    peer: "eBay finish your listing / PangoBooks draft",
    metric: "Viewed Sell Page",
    who: "Signed-in seller",
    when: "Delay 2 hours.",
    exit: "Has done Listing or Unfinished Listing since starting the flow. Unfinished Listing is the separate draft nudge.",
    status: "build_on_existing",
  },
  {
    id: "inactive-seller",
    kind: "winback",
    peer: "Reverb your listings need a refresh",
    metric: "Inactive Seller",
    who: "Seller with stale inventory",
    when: "On the existing inactive-seller schedule.",
    exit: "They published again.",
    status: "build_on_existing",
  },
  {
    id: "welcome",
    kind: "marketing",
    peer: "Reverb, PangoBooks welcome",
    metric: "New Account Created",
    who: "New account",
    when: "Immediately, then a 30-day branch only if they never viewed a listing, sell page, cart, or purchase.",
    exit: "Treat Viewed Listing, Added to Cart, Checkout Started, or Purchase Successful as active.",
    status: "build_on_existing",
  },
]

export function klaviyoActiveUnusedTriggers(): { metric: string; disposition: KlaviyoFlowAuditDisposition }[] {
  return KNOWN_KLAVIYO_METRIC_NAMES.filter((metric) => {
    const disposition = klaviyoMetricFlowDisposition(metric)
    return disposition === "companion_no_email" || disposition === "too_broad" || disposition === "ops_only"
  }).map((metric) => ({ metric, disposition: klaviyoMetricFlowDisposition(metric) }))
}
