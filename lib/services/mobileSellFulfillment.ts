import {
  mobileSellFulfillmentSchema,
  type MobileListingCategory,
  type MobileSellFulfillment,
} from "@reswell/api-contract"

const SHIPPING_COST_OPTIONS = [
  {
    id: "reswell" as const,
    label: "Have Reswell calculate the shipping cost for buyers",
    detail:
      "Buyers pay at checkout; we email you the UPS label. Enter the outer box size and weight you'll ship in.",
    badge: "Recommended",
  },
  {
    id: "free" as const,
    label: "Offer free shipping",
    detail:
      "Buyer pays $0 for shipping at checkout. After the sale, buy a Reswell shipping label or add your own tracking.",
    badge: null,
  },
  {
    id: "flat" as const,
    label: "Set a flat shipping rate",
    detail:
      "One dollar amount buyers in the Continental U.S. pay at checkout. After the sale, buy a Reswell shipping label or add your own tracking.",
    badge: null,
  },
]

const APPAREL_SHIPPING_DETAIL =
  "Buyers pay a live USPS rate at checkout. Reswell buys the label and adds tracking to your sale automatically."

function shipOnly(
  noun: string,
  options: MobileSellFulfillment["shipping_options"],
  extras?: { shipping_detail?: string | null },
): MobileSellFulfillment {
  return mobileSellFulfillmentSchema.parse({
    title: "Shipping",
    description: `Pin where you're shipping from and choose how shipping works. ${noun} listings ship only — local pickup isn't available.`,
    hint: null,
    shipping_default: true,
    shipping_toggle: false,
    shipping_label: "Shipping",
    shipping_badge: null,
    shipping_detail: extras?.shipping_detail ?? null,
    delivery_title: null,
    cost_title: options.length > 0 ? "Shipping cost in the Continental U.S." : null,
    local_pickup: false,
    local_pickup_default: false,
    shipping_options: options,
    package_dimensions: true,
    dropoff: false,
  })
}

const FULFILLMENT_BY_CATEGORY: Record<MobileListingCategory, MobileSellFulfillment> = {
  surfboards: mobileSellFulfillmentSchema.parse({
    title: "Shipping",
    description:
      "Buyers see your city for pickup. Pack and ship it yourself, or drop it off in a city we serve and we pack and ship it for you.",
    hint: "You can select both options.",
    shipping_default: true,
    shipping_toggle: true,
    shipping_label: "Shipping",
    shipping_badge: "Items sell faster",
    shipping_detail: null,
    delivery_title: "Delivery options",
    cost_title: "Shipping cost in the Continental U.S.",
    local_pickup: true,
    local_pickup_default: false,
    shipping_options: SHIPPING_COST_OPTIONS,
    package_dimensions: true,
    dropoff: true,
  }),
  fins: shipOnly("Fin", SHIPPING_COST_OPTIONS),
  wetsuits: shipOnly("Wetsuit", SHIPPING_COST_OPTIONS),
  apparel: shipOnly("Apparel", [], { shipping_detail: APPAREL_SHIPPING_DETAIL }),
  magazines: mobileSellFulfillmentSchema.parse({
    title: "Shipping",
    description:
      "Pin where you're listing from, then enter the outer box you'll ship the magazine or book in. Checkout rates use your location and package size.",
    hint: null,
    shipping_default: true,
    shipping_toggle: false,
    shipping_label: "Shipping",
    shipping_badge: null,
    shipping_detail: null,
    delivery_title: null,
    cost_title: null,
    local_pickup: false,
    local_pickup_default: false,
    shipping_options: [],
    package_dimensions: true,
    dropoff: false,
  }),
  traction: shipOnly("Traction", SHIPPING_COST_OPTIONS),
  boardbags: shipOnly("Boardbag", SHIPPING_COST_OPTIONS),
  surfpacks: shipOnly("Surfpack", SHIPPING_COST_OPTIONS),
  leashes: shipOnly("Leash", SHIPPING_COST_OPTIONS),
  accessories: shipOnly("Accessory", SHIPPING_COST_OPTIONS),
}

/** Shipping section for a sell category. Same rules as that category's website flow. */
export function getMobileSellFulfillment(category: MobileListingCategory): MobileSellFulfillment {
  return FULFILLMENT_BY_CATEGORY[category]
}
