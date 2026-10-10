import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "@/lib/seller-fees"
import {
  HOW_TO_SELL_BEST_RATE_BOX,
  HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN,
  HOW_TO_SELL_BOX_CALCULATOR_PRESETS,
} from "@/lib/seller-resources-box-guide"
import { SHIPPING_DEADLINE_DAYS } from "@/lib/shipping-deadline"

/** Shared seller-resource copy. The website sections and the mobile API both read this. */

export const HOW_TO_SELL_HERO = {
  title: "Create your own surf shop",
  description:
    "Reach buyers nationwide who are looking for boards. List in minutes — free to post, you only pay a fee when it sells.",
}

export const HOW_TO_SELL_VALUES = [
  {
    title: "List in minutes",
    body: "Photos, details, and a price. Pickup, shipping, or both. Listing is always free.",
  },
  {
    title: "Simple shipping",
    body: "Turn on Reswell shipping, enter your box size, and the buyer pays the live label at checkout.",
  },
  {
    title: "Keep most of the sale",
    body: `Reswell takes ${MARKETPLACE_FEE_PERCENT}% of the item price when it sells. You keep ${SELLER_SHARE_PERCENT}%. Shipping is not fee'd.`,
  },
] as const

export const HOW_TO_SELL_WALKTHROUGH_LEAD =
  "Surfboards use a four-step flow on Sell: product info, photos, pricing, then shipping. Stay in Guided mode the first time."

export const HOW_TO_SELL_WALKTHROUGH = [
  {
    title: "Open Sell",
    body: "Go to Sell. Search the catalog by brand or model to pre-fill the form, or start a surfboard from scratch. You can save a draft and come back.",
  },
  {
    title: "Snap the photos buyers need",
    body: "Natural light, a clean background, and up to 12 photos. Drag the strongest deck shot first. Shoot the full deck, bottom and fins, rails, nose and tail, and honest dings.",
  },
  {
    title: "Add details and set your price",
    body: "Title, condition, shape, length, and an honest description. Optionally allow offers or drop the price in two weeks. Check recently sold boards for a similar brand, size, and condition.",
  },
  {
    title: "Turn on shipping and size the box",
    body: `Pin your location, then offer Reswell shipping, pickup, or both. Enter the outer box you will pack into — not the bare board. ${HOW_TO_SELL_BEST_RATE_BOX.lengthIn}×${HOW_TO_SELL_BEST_RATE_BOX.widthIn}×${HOW_TO_SELL_BEST_RATE_BOX.heightIn} and anything under ${HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN}″ length gets the best rates.`,
  },
  {
    title: "Publish",
    body: "Hit Create Listing. It is free to post. Buyers can favorite it, message you, make an offer if you allow them, or buy at your price.",
  },
] as const

export const HOW_TO_SELL_BOXES_LEAD = `For the best rates, pack into ${HOW_TO_SELL_BEST_RATE_BOX.lengthIn}×${HOW_TO_SELL_BEST_RATE_BOX.widthIn}×${HOW_TO_SELL_BEST_RATE_BOX.heightIn} or stay under ${HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN}″ length.`

export const HOW_TO_SHIP_HERO = {
  title: "Ship it so it arrives in one piece",
  description:
    "Offer shipping on a listing, pack the board, and get a label after the sale. Pickup-only still works if you prefer to meet locally.",
}

export const HOW_TO_SHIP_VALUES = [
  {
    title: "Offer it when you list",
    body: "Reswell-calculated rates, a flat Continental U.S. price, or free shipping you cover. Pickup still works.",
  },
  {
    title: "Pack it so it arrives",
    body: "Pad the nose and tail, use a snug board box, and fill gaps so nothing shifts in transit.",
  },
  {
    title: "Print the label",
    body: "After checkout, Reswell buys the label from the box size you entered. Print it from Sales.",
  },
] as const

export const HOW_TO_SHIP_AFTER_SALE_LEAD =
  "Reswell buys the carrier label from the box size on your listing. Pack to that carton, print the PDF, and drop it off."

export const HOW_TO_SHIP_AFTER_SALE = [
  {
    title: "Pack it well",
    body: "Pad the nose and tail, use a snug board box, and fill gaps so nothing shifts.",
  },
  {
    title: "Get a label",
    body: "Open the sale from Sales. Print the Reswell label when one is ready, or add your own tracking.",
  },
  {
    title: "Hand it to the carrier",
    body: `Ship within ${SHIPPING_DEADLINE_DAYS} days of purchase confirmation when you can, then mark the drop-off so the buyer sees progress.`,
  },
] as const

export const HOW_TO_SHIP_PACK_LEAD = `Need a box? Order a recyclable carton from A New Earth Project. ${HOW_TO_SELL_BOXES_LEAD}`

export const HOW_TO_SHIP_DROPOFF =
  "Sellers in Santa Barbara can choose drop-off on a listing. After it sells, we send the location, pack the board, and ship it — a good option if it has not sold locally and you want buyers nationwide."

export const HOW_TO_SHIP_PICKUP =
  "Meet in public, let the buyer inspect the gear, then enter their pickup code on the sale page to release your payout. Read the safety tips before you meet."

export const MORE_SELL_RESOURCES_HERO = {
  title: "Everything you need to sell",
  description:
    "Guides, tools, and the rest of the seller desk. Pricing Hub and the Sell-Out List will land here when we have the data.",
}

export const MORE_SELL_RESOURCES_PRIMARY = [
  {
    title: "For surf shops",
    body: "Open a free account and list the used boards on your rack.",
    screen: "for-surf-shops" as const,
  },
  {
    title: "How to Sell",
    body: "Photo examples, the Sell walkthrough, box sizes, and how to build reviews.",
    screen: "how-to-sell" as const,
  },
  {
    title: "How to Ship",
    body: "Offer shipping, pack a board, print a label, or meet for pickup.",
    screen: "how-to-ship" as const,
  },
  {
    title: "Sales Map",
    body: "See where confirmed Reswell orders travel from seller state to buyer state.",
    screen: "sales-map" as const,
  },
] as const

export const MORE_SELL_RESOURCES_DROPOFF =
  "If a board has not sold locally, offering shipping from Santa Barbara reaches buyers nationwide. We send the location after it sells."

export const SALES_MAP_HERO = {
  title: "Where boards travel",
  description: "Confirmed Reswell orders, from the seller’s state to the buyer’s state.",
}

export function howToSellBoxSizeLines(): string[] {
  return HOW_TO_SELL_BOX_CALCULATOR_PRESETS.map(
    (preset) => `${preset.label}. About ${preset.weightLb} lb packed.`,
  )
}
