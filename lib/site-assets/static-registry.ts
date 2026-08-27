import {
  FALLBACK_HOME_HERO_SLIDE_PATHS,
} from "@/lib/home-hero-slide-urls"
import { helpArticlePath, helpTopicPath } from "@/lib/help-center/paths"
import type { SiteAssetEntry } from "@/lib/types/site-assets"

function publicImage(
  file: string,
  label: string,
  category: SiteAssetEntry["category"],
  pageUrls: string[],
  extra?: Partial<Pick<SiteAssetEntry, "status" | "notes">>,
): SiteAssetEntry {
  const path = `/images/${file}`
  return {
    id: `public:${path}`,
    label,
    displaySrc: path,
    category,
    pageUrls,
    status: extra?.status ?? "active",
    source: `public/images/${file}`,
    notes: extra?.notes,
  }
}

function appMetadata(
  path: string,
  label: string,
  pageUrls: string[],
  notes?: string,
): SiteAssetEntry {
  return {
    id: `app:${path}`,
    label,
    displaySrc: path,
    category: "metadata",
    pageUrls,
    status: "active",
    source: `app/${path.replace(/^\//, "")}`,
    notes,
  }
}

/** Hardcoded `/public/images` and app metadata assets with storefront page references. */
export function listStaticSiteAssets(): SiteAssetEntry[] {
  const assets: SiteAssetEntry[] = [
    publicImage("reswell-logo.png", "Reswell logo (PNG)", "brand", [
      "/",
      "/about",
      "/sell",
      "/blog",
    ], { notes: "Header wordmark fallback; Klaviyo transactional emails." }),
    publicImage("reswell-logo.svg", "Reswell logo (SVG)", "brand", ["/"], {
      notes: "Header wordmark when vector mode is enabled.",
    }),
    publicImage("reswell-full-black.svg", "Reswell wordmark — black", "brand", [], {
      notes: "Supabase auth emails (signup + password reset). Not rendered on storefront pages.",
    }),
    publicImage("reswell-footer-logo.png", "Reswell footer logo", "orphan", [], {
      status: "orphan",
      notes: "Present in /public but not referenced in application code.",
    }),
    publicImage("reswell-mark.png", "Reswell mark", "orphan", [], {
      status: "orphan",
      notes: "Present in /public but not referenced in application code.",
    }),
    publicImage("og-image.jpg", "Listing / brand OG fallback", "brand", [], {
      notes: "Used in listing share cards and brand metadata — not visible in page body.",
    }),

    publicImage("home/hero-backdrop-tahiti.jpg", "Homepage and giveaway hero backdrop", "home", [
      "/",
      "/giveaways",
    ]),
    publicImage("home/hero-backdrop-mesa-v2.jpg", "Legacy homepage hero backdrop", "orphan", [], {
      status: "orphan",
    }),
    publicImage("home/sell-cta-beach-film.jpg", "Unused sell CTA backdrop", "orphan", [], {
      status: "orphan",
    }),
    publicImage("home/hero-backdrop-mesa.jpg", "Legacy homepage hero backdrop (low-res)", "orphan", [], {
      status: "orphan",
    }),
    publicImage("home/hero-backdrop-rincon-v3.jpg", "Legacy homepage hero backdrop", "orphan", [], {
      status: "orphan",
    }),
    publicImage(
      "home/how-it-works-sell-list.png",
      "How it works — list a board",
      "home",
      ["/", "/help", "/help/buying", "/help/selling", "/help/accounts"],
    ),
    publicImage(
      "home/how-it-works-sell-connect.png",
      "How it works — connect & sell",
      "home",
      ["/", "/about", "/help", "/help/buying", "/help/selling", "/help/accounts", "/what-is-reswell"],
    ),

    publicImage("home/hero-bg.png", "Legacy hero background", "orphan", [], { status: "orphan" }),
    publicImage("home/wave-1.png", "Decorative wave 1", "orphan", [], { status: "orphan" }),
    publicImage("home/wave-2.png", "Decorative wave 2", "orphan", [], { status: "orphan" }),
    publicImage("home/wave-3.png", "Decorative wave 3", "orphan", [], { status: "orphan" }),
    publicImage("home/wave-4.png", "Decorative wave 4", "orphan", [], { status: "orphan" }),

    publicImage("about/headline-oz-aerial.jpg", "About — headline atmosphere", "about", [
      "/about",
      "/what-is-reswell",
    ]),
    publicImage("about/our-story-beach-film.jpg", "About — Our story photo", "about", [
      "/about",
      "/what-is-reswell",
    ]),
    publicImage("about/david-kalt.png", "David Kalt — founder photo", "about", ["/about"]),

    publicImage("brand/auth-backdrop.jpg", "Auth landing backdrop (empty barrel)", "brand", [
      "/auth/login",
      "/auth/sign-up",
    ]),
    publicImage("brand/auth-backdrop-alt.jpg", "Unused aerial backdrop", "orphan", [], {
      status: "orphan",
    }),
    publicImage("brand/empty-state-wave.jpg", "Favorites empty-state / auth source", "brand", [
      "/auth/login",
      "/auth/sign-up",
    ]),
    publicImage("brand/fiji-underboard.jpg", "Fins browse + messages atmosphere", "brand", [
      "/fins",
      "/messages",
    ]),
    publicImage("brand/boards-browse-barrel.jpg", "Surfboards browse atmosphere (Hawaii aerial)", "brand", [
      "/boards",
    ]),
    publicImage(
      "cities/santa-barbara-mesa-lane.jpg",
      "Santa Barbara city landing atmosphere",
      "marketing",
      ["/reswell/santa-barbara"],
    ),
    publicImage(
      "cities/charleston-coast.jpg",
      "Charleston city landing atmosphere",
      "marketing",
      ["/reswell/charleston"],
    ),
    publicImage(
      "cities/los-angeles-coast.jpg",
      "Los Angeles city landing atmosphere",
      "marketing",
      ["/reswell/los-angeles"],
    ),
    publicImage(
      "cities/surf-shops/rincon-designs.jpg",
      "Rincon Designs Surf Shop logo",
      "marketing",
      [
        "/reswell/santa-barbara",
        "/reswell/carpinteria",
        "/surf-shops",
        "/surf-shops/rincon-designs",
      ],
    ),
    publicImage(
      "cities/surf-shops/beach-house-santa-barbara.jpg",
      "Beach House Santa Barbara logo",
      "marketing",
      ["/reswell/santa-barbara", "/surf-shops", "/surf-shops/beach-house-santa-barbara"],
    ),
    publicImage(
      "cities/surf-shops/surf-country-goleta.jpg",
      "Surf Country Goleta logo",
      "marketing",
      ["/reswell/goleta", "/surf-shops", "/surf-shops/surf-country-goleta"],
    ),
    publicImage(
      "cities/surf-shops/ventura-surf-shop.png",
      "Ventura Surf Shop logo",
      "marketing",
      ["/reswell/ventura", "/reswell/oxnard", "/surf-shops", "/surf-shops/ventura-surf-shop"],
    ),
    publicImage(
      "cities/surf-shops/drill-surf-skate.png",
      "Drill Surf & Skate logo",
      "marketing",
      ["/reswell/malibu", "/surf-shops", "/surf-shops/drill-surf-skate"],
    ),
    publicImage(
      "cities/surf-shops/rider-shack.png",
      "Rider Shack logo",
      "marketing",
      ["/reswell/los-angeles", "/surf-shops", "/surf-shops/rider-shack"],
    ),
    publicImage(
      "cities/surf-shops/surf-ride.png",
      "Surf Ride logo",
      "marketing",
      ["/reswell/oceanside", "/surf-shops", "/surf-shops/surf-ride"],
    ),
    publicImage(
      "cities/surf-shops/used-surf.png",
      "UsedSurf logo",
      "marketing",
      ["/reswell/san-clemente", "/surf-shops", "/surf-shops/used-surf"],
    ),
    publicImage(
      "cities/surf-shops/hansen-surf.jpg",
      "Hansen Surfboards logo",
      "marketing",
      ["/reswell/encinitas", "/reswell/del-mar", "/surf-shops", "/surf-shops/hansen-surfboards"],
    ),
    publicImage(
      "cities/surf-shops/south-coast-surf-shop.png",
      "South Coast Surf Shop logo",
      "marketing",
      ["/reswell/san-diego", "/surf-shops", "/surf-shops/south-coast-surf-shop"],
    ),
    publicImage(
      "cities/surf-shops/mitchs-surf-shop.png",
      "Mitch's Surf Shop logo",
      "marketing",
      ["/reswell/san-diego", "/surf-shops", "/surf-shops/mitchs-surf-shop"],
    ),
    publicImage(
      "cities/surf-shops/freeline-surf.png",
      "Freeline Surf Shop logo",
      "marketing",
      ["/reswell/santa-cruz", "/surf-shops", "/surf-shops/freeline-surf-shop"],
    ),
    publicImage(
      "cities/surf-shops/mollusk.png",
      "Mollusk Surf Shop logo",
      "marketing",
      ["/reswell/san-francisco", "/surf-shops", "/surf-shops/mollusk-surf-shop"],
    ),
    publicImage(
      "cities/surf-shops/wavelengths.png",
      "Wavelengths Surf Shop logo",
      "marketing",
      [
        "/reswell/morro-bay",
        "/reswell/los-osos",
        "/reswell/san-luis-obispo",
        "/surf-shops",
        "/surf-shops/wavelengths",
      ],
    ),
    publicImage(
      "cities/surf-shops/urban-surf.jpg",
      "Urban Surf logo",
      "marketing",
      ["/reswell/seattle", "/surf-shops", "/surf-shops/urban-surf"],
    ),
    publicImage(
      "cities/surf-shops/mckevlins.png",
      "McKevlin's Surf Shop logo",
      "marketing",
      ["/reswell/charleston", "/surf-shops", "/surf-shops/mckevlins"],
    ),
    publicImage(
      "cities/surf-shops/hic-kailua.jpg",
      "Hawaiian Island Creations logo",
      "marketing",
      ["/reswell/kailua", "/surf-shops", "/surf-shops/hic-kailua"],
    ),
    publicImage(
      "cities/surf-shops/glide-surf-co.png",
      "Glide Surf Co. logo",
      "marketing",
      ["/reswell/asbury-park", "/surf-shops", "/surf-shops/glide-surf-co"],
    ),
    publicImage(
      "cities/ventura-pier.jpg",
      "Ventura city landing atmosphere",
      "marketing",
      ["/reswell/ventura"],
      { notes: "Wikimedia Commons public domain — File:Ventura_aerial.jpg (Jimwmurphy, 2010)." },
    ),
    publicImage(
      "cities/san-diego-blacks-beach.jpg",
      "San Diego city landing atmosphere",
      "marketing",
      ["/reswell/san-diego"],
      { notes: "Unsplash License — Blacks Beach aerial, WNZoVFUXE9E." },
    ),
    publicImage(
      "cities/oceanside-pier.jpg",
      "Oceanside city landing atmosphere",
      "marketing",
      ["/reswell/oceanside"],
      { notes: "Pexels License — Oceanside Pier drone with surfers, photo 14869692." },
    ),
    publicImage(
      "cities/kailua-lanikai.jpg",
      "Kailua city landing atmosphere",
      "marketing",
      ["/reswell/kailua"],
      { notes: "Unsplash License — Lanikai / Mokulua Islands, 1w2xsyc2wwI." },
    ),
    publicImage(
      "cities/malibu-zuma.jpg",
      "Malibu city landing atmosphere",
      "marketing",
      ["/reswell/malibu"],
      { notes: "Unsplash License — Zuma Beach surfers, cmYAv6PbA58." },
    ),
    publicImage(
      "cities/san-francisco-ocean-beach.jpg",
      "San Francisco city landing atmosphere",
      "marketing",
      ["/reswell/san-francisco"],
      { notes: "Unsplash License — Ocean Beach, hIDUFLrD4WQ." },
    ),
    publicImage("brand/wetsuits-browse-atmosphere.jpg", "Wetsuits browse atmosphere", "brand", [
      "/wetsuits",
    ]),
    publicImage("brand/apparel-browse-atmosphere.jpg", "Apparel browse atmosphere", "brand", [
      "/apparel",
    ]),
    publicImage("brand/boards-shaper-workshop.jpg", "Unused shaper workshop photo", "orphan", [], {
      status: "orphan",
    }),
    publicImage("brand/hawaii-aerial.jpg", "Contact atmosphere", "brand", ["/contact"]),
    publicImage("brand/tahiti-barrel.jpg", "Unused categories backdrop", "orphan", [], {
      status: "orphan",
    }),
    publicImage("brand/auth-backdrop-original.jpg", "Unused Portugal athlete original", "orphan", [], {
      status: "orphan",
      notes: "Clear athlete face — do not use on storefront without release.",
    }),
    publicImage("sell/sell-hub-backdrop-original.jpg", "Unused Maldives athlete original", "orphan", [], {
      status: "orphan",
      notes: "Clear athlete face — do not use on storefront without release.",
    }),
    publicImage("brand/tahiti-barrel-original.jpg", "Unused Tahiti athlete original", "orphan", [], {
      status: "orphan",
      notes: "Clear athlete face — do not use on storefront without release.",
    }),

    publicImage("sell/sell-hub-backdrop.jpg", "Unused sell hub atmosphere strip", "orphan", [], {
      status: "orphan",
    }),
    publicImage(
      "marketing/list-your-surfboard-share.jpg",
      "List your surfboard — Open Graph share image",
      "marketing",
      ["/listyoursurfboard"],
      { notes: "og:image / twitter:image for /listyoursurfboard. Cropped from brand/fiji-underboard.jpg." },
    ),
    publicImage("sell/surfboard.jpg", "Sell type — surfboard", "sell", ["/sell"]),
    publicImage("sell/fins.jpg", "Sell type — fins", "sell", ["/sell"]),

    publicImage(
      "help-center/shopping-on-reswell.jpg",
      "Help buying — Shopping on Reswell category",
      "help-center",
      ["/help", helpTopicPath("buying")],
    ),
    publicImage(
      "help-center/checkout.jpg",
      "Help buying — Checkout category",
      "help-center",
      ["/help", helpTopicPath("buying")],
    ),
    publicImage(
      "help-center/managing-purchases.jpg",
      "Help buying — Managing purchases category",
      "help-center",
      ["/help", helpTopicPath("buying")],
    ),
    publicImage(
      "help-center/browse-boards.png",
      "Help — browse boards screenshot",
      "help-center",
      [helpArticlePath("buying", "how-do-i-buy-a-board")],
    ),
    publicImage(
      "help-center/listing-detail.png",
      "Help — listing detail screenshot",
      "help-center",
      [
        helpArticlePath("buying", "how-do-i-buy-a-board"),
        helpArticlePath("buying", "how-do-offers-work"),
        helpArticlePath("buying", "how-do-favorites-work"),
      ],
    ),
    publicImage(
      "help-center/purchase-protection.png",
      "Help — purchase protection screenshot",
      "help-center",
      [helpArticlePath("buying", "purchase-protection-claim")],
    ),
    publicImage(
      "help-center/sign-in.png",
      "Help — sign in screenshot",
      "help-center",
      [
        helpArticlePath("selling", "how-to-list-a-board"),
        helpArticlePath("accounts", "account-access-deletion"),
      ],
    ),
    publicImage("help-center/help-buying-index.png", "Help buying tab capture", "orphan", ["/help"], {
      status: "orphan",
      notes: "Generated by capture script but not wired into the UI.",
    }),
    publicImage("help-center/help-selling-index.png", "Help selling tab capture", "orphan", ["/help"], {
      status: "orphan",
      notes: "Generated by capture script but not wired into the UI.",
    }),

    publicImage("email/instagram.svg", "Instagram icon", "email", [], {
      notes: "Supabase auth email footer — not on storefront pages.",
    }),

    appMetadata("/icon.png", "Favicon", ["*"], "Browser tab icon on all pages."),
    appMetadata("/apple-icon.png", "Apple touch icon", ["*"], "Add-to-home-screen icon."),
    appMetadata(
      "/opengraph-image.jpg",
      "Default Open Graph image",
      ["*"],
      "Fallback social share image when a page has no custom OG image.",
    ),
  ]

  for (const slidePath of FALLBACK_HOME_HERO_SLIDE_PATHS) {
    const file = slidePath.replace("/images/", "")
    assets.push({
      id: `public:${slidePath}`,
      label: `Hero slide fallback — ${file.replace("home/", "")}`,
      displaySrc: slidePath,
      category: "marketing",
      pageUrls: ["/about", "/listyoursurfboard"],
      status: "fallback",
      source: `public/images/${file}`,
      notes: "Used when About / marketing hero stacks need padding; not the live homepage backdrop.",
    })
  }

  return assets
}
