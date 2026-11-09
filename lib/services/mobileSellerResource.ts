import {
  MOBILE_SELLER_RESOURCE_SLUGS,
  mobileSellerResourceSchema,
  type MobileSellerResource,
  type MobileSellerResourceSlug,
} from "@reswell/api-contract"
import {
  FOR_SURF_SHOPS_DESCRIPTION,
  FOR_SURF_SHOPS_FAQS,
  FOR_SURF_SHOPS_HERO_DESCRIPTION,
  FOR_SURF_SHOPS_STEPS,
  FOR_SURF_SHOPS_USES,
  FOR_SURF_SHOPS_VALUES,
  forSurfShopsAccountHref,
  forSurfShopsAccountLabel,
} from "@/lib/for-surf-shops"
import { helpArticlePath, helpTopicPath } from "@/lib/help-center/paths"
import {
  HOW_TO_SELL_BOXES_LEAD,
  HOW_TO_SELL_HERO,
  HOW_TO_SELL_VALUES,
  HOW_TO_SELL_WALKTHROUGH,
  HOW_TO_SELL_WALKTHROUGH_LEAD,
  HOW_TO_SHIP_AFTER_SALE,
  HOW_TO_SHIP_AFTER_SALE_LEAD,
  HOW_TO_SHIP_DROPOFF,
  HOW_TO_SHIP_HERO,
  HOW_TO_SHIP_PACK_LEAD,
  HOW_TO_SHIP_PICKUP,
  HOW_TO_SHIP_VALUES,
  howToSellBoxSizeLines,
  MORE_SELL_RESOURCES_DROPOFF,
  MORE_SELL_RESOURCES_HERO,
  MORE_SELL_RESOURCES_PRIMARY,
  SALES_MAP_HERO,
} from "@/lib/seller-resource-copy"
import { SANTA_BARBARA_DROPOFF_HREF } from "@/lib/dropoff-santa-barbara"
import { sellerResourcesComingSoon } from "@/lib/seller-resources"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"
import type { HowToSellGuidePayload } from "@/lib/types/seller-resources-how-to-sell"
import type { MarketplaceSalesMapFlow, MarketplaceSalesMapTotals } from "@/lib/types/marketplace-sales-map"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { usStateDisplayName } from "@/lib/utils/us-state-names"

type SellerResourceCard = {
  title: string
  body: string
  screen: MobileSellerResourceSlug | null
  listing_id: string | null
  image_url: string | null
  href: string | null
  badge: string | null
}

type SellerResourceExtras = {
  guide?: HowToSellGuidePayload
  totals?: MarketplaceSalesMapTotals
  flows?: MarketplaceSalesMapFlow[]
  /** Same signed-in rules as the website landing pages. */
  signedIn?: boolean
}

function isSellerResourceSlug(slug: string): slug is MobileSellerResourceSlug {
  return (MOBILE_SELLER_RESOURCE_SLUGS as readonly string[]).includes(slug)
}

function card(
  title: string,
  body: string,
  extra?: Partial<Pick<SellerResourceCard, "screen" | "listing_id" | "image_url" | "href" | "badge">>,
): SellerResourceCard {
  return {
    title,
    body,
    screen: extra?.screen ?? null,
    listing_id: extra?.listing_id ?? null,
    image_url: extra?.image_url ?? null,
    href: extra?.href ?? null,
    badge: extra?.badge ?? null,
  }
}

function httpUrl(value: string | null | undefined): string | null {
  if (!value) return null
  return value.startsWith("https://") || value.startsWith("http://") ? value : null
}

function money(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

function withCta(
  page: Omit<MobileSellerResource, "cta_label" | "cta_href">,
  cta?: { label: string; href: string } | null,
): MobileSellerResource {
  return {
    ...page,
    cta_label: cta?.label ?? null,
    cta_href: cta?.href ?? null,
  }
}

function forSurfShops(signedIn: boolean): MobileSellerResource {
  return withCta(
    {
      slug: "for-surf-shops",
      title: "For surf shops",
      description: FOR_SURF_SHOPS_DESCRIPTION,
      sections: [
        {
          kind: "paragraphs",
          title: "Sell used boards from your shop",
          paragraphs: [FOR_SURF_SHOPS_HERO_DESCRIPTION],
        },
        {
          kind: "cards",
          title: "Why shops list on Reswell",
          cards: FOR_SURF_SHOPS_VALUES.map((item) => card(item.title, item.body)),
        },
        { kind: "steps", title: "How a shop gets started", steps: [...FOR_SURF_SHOPS_STEPS] },
        {
          kind: "cards",
          title: "What shops list",
          cards: FOR_SURF_SHOPS_USES.map((item) => card(item.title, item.body)),
        },
        {
          kind: "faqs",
          title: signedIn ? "Selling from the shop" : "Before you open an account",
          items: FOR_SURF_SHOPS_FAQS.map((item) => ({ question: item.question, answer: item.answer })),
        },
      ],
    },
    {
      label: forSurfShopsAccountLabel(signedIn),
      href: forSurfShopsAccountHref(signedIn),
    },
  )
}

function howToSell(extras: SellerResourceExtras): MobileSellerResource {
  const photos = (extras.guide?.photoExamples ?? [])
    .filter((example) => example.title)
    .slice(0, 6)
    .map((example) =>
      card(example.title, example.condition ?? "A listing buyers can open.", {
        listing_id: example.listingId,
        image_url: httpUrl(example.images[0]),
        href: example.href || null,
      }),
    )
  const shops = (extras.guide?.shops ?? []).slice(0, 6).map((shop) => {
    const bits = [
      shop.location,
      shop.salesCount > 0 ? `${shop.salesCount} sales` : null,
      shop.reviewCount > 0 ? `${shop.avgRating.toFixed(1)} from ${shop.reviewCount} reviews` : null,
    ].filter((bit): bit is string => Boolean(bit))
    return card(shop.name, bits.join(" · ") || "A Reswell seller.", {
      image_url: httpUrl(shop.avatarSrc),
      href: shop.href || null,
      badge: shop.verified ? "Verified" : null,
    })
  })
  return withCta(
    {
      slug: "how-to-sell",
      title: "How to Sell",
      description: HOW_TO_SELL_HERO.description,
      sections: [
        { kind: "paragraphs", title: HOW_TO_SELL_HERO.title, paragraphs: [HOW_TO_SELL_HERO.description] },
        {
          kind: "cards",
          title: null,
          cards: HOW_TO_SELL_VALUES.map((item) => card(item.title, item.body)),
        },
        {
          kind: "steps",
          title: "List a surfboard",
          steps: HOW_TO_SELL_WALKTHROUGH.map((step) => ({ title: step.title, body: step.body })),
        },
        {
          kind: "paragraphs",
          title: "Box sizes",
          paragraphs: [HOW_TO_SELL_WALKTHROUGH_LEAD, HOW_TO_SELL_BOXES_LEAD, ...howToSellBoxSizeLines()],
        },
        ...(photos.length > 0 ? [{ kind: "cards" as const, title: "Photo examples", cards: photos }] : []),
        ...(shops.length > 0 ? [{ kind: "cards" as const, title: "Shops on Reswell", cards: shops }] : []),
      ],
    },
    { label: "Start a listing", href: SURFBOARD_SELL_BOARDS_CREATE_HREF },
  )
}

function howToShip(): MobileSellerResource {
  return withCta(
    {
      slug: "how-to-ship",
      title: "How to Ship",
      description: HOW_TO_SHIP_HERO.description,
      sections: [
        { kind: "paragraphs", title: HOW_TO_SHIP_HERO.title, paragraphs: [HOW_TO_SHIP_HERO.description] },
        {
          kind: "cards",
          title: null,
          cards: HOW_TO_SHIP_VALUES.map((item) => card(item.title, item.body)),
        },
        {
          kind: "steps",
          title: "After it sells",
          steps: HOW_TO_SHIP_AFTER_SALE.map((step) => ({ title: step.title, body: step.body })),
        },
        {
          kind: "paragraphs",
          title: "Packing",
          paragraphs: [HOW_TO_SHIP_AFTER_SALE_LEAD, HOW_TO_SHIP_PACK_LEAD],
        },
        {
          kind: "cards",
          title: "Box sizes for rates",
          cards: howToSellBoxSizeLines().map((line) => {
            const [label, rest] = line.split(". ")
            return card(label ?? line, rest ?? HOW_TO_SELL_BOXES_LEAD)
          }),
        },
        {
          kind: "cards",
          title: "Rather not pack it yourself?",
          cards: [
            card("Drop it off in Santa Barbara", HOW_TO_SHIP_DROPOFF, {
              href: SANTA_BARBARA_DROPOFF_HREF,
            }),
            card("Meet locally", HOW_TO_SHIP_PICKUP, { href: "/safety" }),
          ],
        },
      ],
    },
    { label: "Start a listing", href: SURFBOARD_SELL_BOARDS_CREATE_HREF },
  )
}

function salesMap(extras: SellerResourceExtras): MobileSellerResource {
  const totals = extras.totals
  const flows = [...(extras.flows ?? [])].sort((a, b) => b.count - a.count).slice(0, 8)
  return withCta(
    {
      slug: "sales-map",
      title: "Sales Map",
      description: SALES_MAP_HERO.description,
      sections: [
        { kind: "paragraphs", title: SALES_MAP_HERO.title, paragraphs: [SALES_MAP_HERO.description] },
        ...(totals
          ? [
              {
                kind: "paragraphs" as const,
                title: "Confirmed orders",
                paragraphs: [
                  `${totals.confirmedSales.toLocaleString("en-US")} confirmed sales, ${money(totals.volumeUsd)} in item volume.`,
                  `${totals.statesSelling.toLocaleString("en-US")} states selling and ${totals.statesBuying.toLocaleString("en-US")} states buying. ${totals.crossStateSales.toLocaleString("en-US")} of those orders crossed state lines.`,
                ],
              },
            ]
          : []),
        ...(flows.length > 0
          ? [
              {
                kind: "cards" as const,
                title: "Busiest routes",
                cards: flows.map((flow) =>
                  card(
                    `${usStateDisplayName(flow.sellerState)} to ${usStateDisplayName(flow.buyerState)}`,
                    `${flow.count.toLocaleString("en-US")} orders · ${money(flow.volumeUsd)}`,
                  ),
                ),
              },
            ]
          : []),
      ],
    },
    null,
  )
}

function hub(): MobileSellerResource {
  const guides = [
    { title: "Selling fees", href: helpArticlePath("selling", "marketplace-fees") },
    { title: "Connect payouts", href: helpArticlePath("selling", "connect-payout-account") },
    { title: "I made a sale — what's next?", href: helpArticlePath("selling", "i-sold-an-item-whats-next") },
    { title: "We’ll buy your surfboard", href: helpArticlePath("selling", "we-buy-your-surfboard") },
    { title: "Purchase Protection", href: "/protection-policy" },
    { title: "Help Center — selling", href: helpTopicPath("selling") },
    { title: "Shipping estimator", href: "/shipping-estimator" },
  ]
  return withCta(
    {
      slug: "seller-resources",
      title: "More Sell Resources",
      description: MORE_SELL_RESOURCES_HERO.description,
      sections: [
        {
          kind: "paragraphs",
          title: MORE_SELL_RESOURCES_HERO.title,
          paragraphs: [MORE_SELL_RESOURCES_HERO.description],
        },
        {
          kind: "cards",
          title: "Start with the basics",
          cards: MORE_SELL_RESOURCES_PRIMARY.map((item) =>
            card(item.title, item.body, { screen: item.screen }),
          ),
        },
        {
          kind: "paragraphs",
          title: "Santa Barbara drop-off",
          paragraphs: [MORE_SELL_RESOURCES_DROPOFF],
        },
        {
          kind: "cards",
          title: "Coming soon",
          cards: sellerResourcesComingSoon.map((item) =>
            card(item.label, item.description, { badge: "Soon" }),
          ),
        },
        {
          kind: "cards",
          title: "Guides and tools",
          cards: guides.map((item) => card(item.title, "", { href: item.href })),
        },
      ],
    },
    { label: "Start a listing", href: SURFBOARD_SELL_BOARDS_CREATE_HREF },
  )
}

/** Pure document builder. Tests pass extras instead of hitting the database. */
export function buildMobileSellerResource(
  slug: MobileSellerResourceSlug,
  extras: SellerResourceExtras = {},
): MobileSellerResource {
  const signedIn = extras.signedIn === true
  const document =
    slug === "for-surf-shops"
      ? forSurfShops(signedIn)
      : slug === "how-to-sell"
        ? howToSell(extras)
        : slug === "how-to-ship"
          ? howToShip()
          : slug === "sales-map"
            ? salesMap(extras)
            : hub()
  return mobileSellerResourceSchema.parse(document)
}

export async function getMobileSellerResource(
  slug: string,
  options: { signedIn?: boolean } = {},
): Promise<MobileApiResult<MobileSellerResource>> {
  if (!isSellerResourceSlug(slug)) {
    return { ok: false, status: 404, error: "Page not found" }
  }
  const extras = await loadExtras(slug)
  return {
    ok: true,
    data: buildMobileSellerResource(slug, { ...extras, signedIn: options.signedIn === true }),
  }
}

async function loadExtras(slug: MobileSellerResourceSlug): Promise<SellerResourceExtras> {
  if (slug === "how-to-sell") {
    try {
      const { getCachedHowToSellGuidePayload } = await import("@/lib/cache/seller-resources-how-to-sell")
      return { guide: await getCachedHowToSellGuidePayload() }
    } catch (error) {
      console.error("[mobile-api] how-to-sell extras failed", {
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      })
      return {}
    }
  }
  if (slug === "sales-map") {
    try {
      const { getCachedMarketplaceSalesMap } = await import("@/lib/cache/marketplace-sales-map")
      const map = await getCachedMarketplaceSalesMap()
      return { totals: map.totals, flows: map.flows }
    } catch (error) {
      console.error("[mobile-api] sales map extras failed", {
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      })
      return {}
    }
  }
  return {}
}
