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
      "/giveaways/win-a-custom-surfboard",
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
      "/favorites",
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
