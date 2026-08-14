/**
 * Registry of the pages that matter for SEO. This is the single source of truth for each
 * page's title, description, canonical, robots, and share images. The admin SEO panel at
 * `/admin/seo` is a read-only reference — edit these defaults in code (or ask Cursor to).
 *
 * To add a new page: add an entry here, then call `resolvePageMetadata(key)` from its
 * `generateMetadata`.
 */

export type ManagedPageGroupId =
  | "core"
  | "marketplace"
  | "content"
  | "trust"
  | "marketing"
  | "dynamic"

export interface ManagedPageGroup {
  id: ManagedPageGroupId
  label: string
  description: string
}

export const MANAGED_PAGE_GROUPS: ManagedPageGroup[] = [
  { id: "core", label: "Core pages", description: "The highest-traffic entry points." },
  { id: "marketplace", label: "Marketplace", description: "Browse, shop, and directory hubs." },
  { id: "content", label: "Content & community", description: "Editorial, forum, and help." },
  { id: "trust", label: "Trust & legal", description: "Policies buyers and sellers check." },
  { id: "marketing", label: "Marketing & growth", description: "Landing and conversion pages." },
  { id: "dynamic", label: "Dynamic page types", description: "Templates applied to every listing, brand, and seller." },
]

export interface ManagedPageDefaults {
  title: string
  description: string
  /** Canonical path (used for canonical + OG url). */
  path: string
  openGraphType: "website" | "article"
  robotsIndex: boolean
  robotsFollow: boolean
  keywords?: string[]
  ogTitle?: string
  ogDescription?: string
  ogImageUrl?: string
  twitterCard?: "summary" | "summary_large_image"
  twitterTitle?: string
  twitterDescription?: string
  twitterImageUrl?: string
  structuredData?: unknown
}

export interface ManagedPage {
  /** Stable key — never change once shipped (referenced in code and admin SEO panel). */
  key: string
  group: ManagedPageGroupId
  /** Human label shown in the panel. */
  label: string
  /** Short note explaining what this page/variation is, shown under the label. */
  note?: string
  /** A variation of another page (e.g. a filtered view) rather than a standalone route. */
  variationOf?: string
  defaults: ManagedPageDefaults
}

function page(
  key: string,
  group: ManagedPageGroupId,
  label: string,
  defaults: {
    title: string
    description: string
    path: string
    openGraphType?: "website" | "article"
    robotsIndex?: boolean
    robotsFollow?: boolean
    keywords?: string[]
    ogTitle?: string
    ogDescription?: string
    ogImageUrl?: string
    twitterCard?: "summary" | "summary_large_image"
    twitterTitle?: string
    twitterDescription?: string
    twitterImageUrl?: string
    structuredData?: unknown
  },
  extra?: { note?: string; variationOf?: string },
): ManagedPage {
  return {
    key,
    group,
    label,
    note: extra?.note,
    variationOf: extra?.variationOf,
    defaults: {
      title: defaults.title,
      description: defaults.description,
      path: defaults.path,
      openGraphType: defaults.openGraphType ?? "website",
      robotsIndex: defaults.robotsIndex ?? true,
      robotsFollow: defaults.robotsFollow ?? true,
      keywords: defaults.keywords,
      ogTitle: defaults.ogTitle,
      ogDescription: defaults.ogDescription,
      ogImageUrl: defaults.ogImageUrl,
      twitterCard: defaults.twitterCard,
      twitterTitle: defaults.twitterTitle,
      twitterDescription: defaults.twitterDescription,
      twitterImageUrl: defaults.twitterImageUrl,
      structuredData: defaults.structuredData,
    },
  }
}

export const MANAGED_PAGES: ManagedPage[] = [
  // ---- Core ----
  page("home", "core", "Homepage", {
    title: "Buy & Sell Used Surfboards | Reswell",
    description:
      "Peer-to-peer marketplace for surfboards and surf gear. Browse boards, fins, wetsuits, and more — or list yours today.",
    path: "/",
    ogImageUrl:
      "https://lqwsewptsirsglasnwmn.supabase.co/storage/v1/object/public/seo-assets/share-images/1260e45d-5bbd-4e3e-9e02-9b7995b2f23e.jpg",
  }),
  page("about", "core", "About", {
    title: "About Reswell | Nationwide Surfboard Marketplace",
    description:
      "Reswell connects surfers nationwide to buy and sell surfboards with built in shipping, checkout on the site, and Purchase Protection for eligible purchases.",
    path: "/about",
    ogImageUrl:
      "https://lqwsewptsirsglasnwmn.supabase.co/storage/v1/object/public/seo-assets/share-images/e4235355-97b9-4331-b9e0-8cca85c9644b.jpg",
  }),
  page("what-is-reswell", "core", "What is Reswell", {
    title: "What is Reswell? Surfboard Marketplace | Reswell",
    description:
      "Learn how Reswell connects surfers to buy and sell surfboards and gear safely with messaging, shipping tools, and Purchase Protection.",
    path: "/what-is-reswell",
    ogTitle: "What is Reswell? The Used Surfboard Marketplace",
    ogImageUrl:
      "https://lqwsewptsirsglasnwmn.supabase.co/storage/v1/object/public/seo-assets/share-images/fa694836-fa30-4c2b-bde7-ebf2f16b33f6.jpg",
  }),
  page("contact", "core", "Contact", {
    title: "Contact Reswell Support | Reswell",
    description:
      "Get help with your surfboard marketplace account, orders, or safety questions. Our support team is here to assist you.",
    path: "/contact",
    ogImageUrl:
      "https://lqwsewptsirsglasnwmn.supabase.co/storage/v1/object/public/seo-assets/share-images/834f5712-af90-43f9-acf1-c4ce0e87daea.jpg",
  }),

  // ---- Marketplace ----
  page("boards", "marketplace", "Browse boards", {
    title: "Buy Used Surfboards - Browse Boards | Reswell",
    description:
      "Shop quality pre-owned surfboards from local surfers and shapers. Find shortboards, longboards, fish, and funboards near you at fair prices.",
    path: "/boards",
    ogImageUrl:
      "https://lqwsewptsirsglasnwmn.supabase.co/storage/v1/object/public/seo-assets/share-images/5bd393e4-9e8d-43b5-a653-c9c741a23d04.jpg",
  }, { note: "Main /boards browse hub. Variations below override the filtered views." }),
  page("fins", "marketplace", "Browse fins", {
    title: "Surfboard Fins For Sale | Reswell",
    description:
      "Browse used and pre-owned surfboard fins for sale. Find Futures, FCS, and more from surfers on Reswell.",
    path: "/fins",
  }, { note: "Main /fins browse hub." }),
  page("wetsuits", "marketplace", "Browse wetsuits", {
    title: "Wetsuits For Sale | Reswell",
    description:
      "Browse used and pre-owned wetsuits for sale. Find steamers, springsuits, and more from surfers on Reswell.",
    path: "/wetsuits",
  }, { note: "Main /wetsuits browse hub." }),
  page("boardbags", "marketplace", "Browse boardbags", {
    title: "Boardbags For Sale | Reswell",
    description:
      "Browse used and pre-owned boardbags for sale. Find day bags, travel bags, and coffins from surfers on Reswell.",
    path: "/boardbags",
  }, { note: "Main /boardbags browse hub." }),
  page("surfpacks", "marketplace", "Browse surfpacks", {
    title: "Surfpacks For Sale | Reswell",
    description:
      "Browse used and pre-owned surfpacks for sale. Find surf gear bundles from surfers on Reswell.",
    path: "/surfpacks",
  }, { note: "Main /surfpacks browse hub." }),
  page("leashes", "marketplace", "Browse leashes", {
    title: "Surf Leashes For Sale | Reswell",
    description:
      "Browse used and pre-owned surf leashes for sale. Find leashes from surfers on Reswell.",
    path: "/leashes",
  }, { note: "Main /leashes browse hub." }),
  page("apparel", "marketplace", "Browse apparel", {
    title: "Surf Apparel For Sale | Reswell",
    description:
      "Browse used and pre-owned surf apparel for sale. Find boardshorts, tees, and more from surfers on Reswell.",
    path: "/apparel",
  }, { note: "Main /apparel browse hub." }),
  page("accessories", "marketplace", "Browse accessories", {
    title: "Surf Accessories For Sale | Reswell",
    description:
      "Browse used and pre-owned surf accessories for sale. Find wax, traction, tools, and more from surfers on Reswell.",
    path: "/accessories",
  }, { note: "Main /accessories browse hub." }),
  page("magazines", "marketplace", "Browse magazines", {
    title: "Surf Magazines For Sale | Reswell",
    description:
      "Browse vintage and collectible surf magazines for sale. Collector issues and classic publications — shipped from Reswell.",
    path: "/magazines",
  }, { note: "Main /magazines browse hub." }),
  page("boards:type=shortboard", "marketplace", "Boards — Shortboards", {
    title: "Shortboards For Sale | Reswell",
    description:
      "Browse shortboards for sale. Find shortboards, longboards, grovelers, and more from local surfers on Reswell.",
    path: "/boards?type=shortboard",
    ogImageUrl:
      "https://lqwsewptsirsglasnwmn.supabase.co/storage/v1/object/public/seo-assets/share-images/bf2b375b-6705-4c6b-afd6-ddedcbbed885.jpg",
  }, { variationOf: "boards", note: "/boards?type=shortboard" }),
  page("boards:type=longboard", "marketplace", "Boards — Longboards", {
    title: "Used Longboards For Sale | Reswell",
    description:
      "Buy and sell used longboards direct from local surfers. Browse classic logs, single fins, and performance longboards at great prices.",
    path: "/boards?type=longboard",
    ogImageUrl:
      "https://lqwsewptsirsglasnwmn.supabase.co/storage/v1/object/public/seo-assets/share-images/e818f8dd-0220-4b80-8cc4-f476e2772d3e.jpg",
  }, { variationOf: "boards", note: "/boards?type=longboard" }),
  page("boards:type=hybrid", "marketplace", "Boards — Hybrid", {
    title: "Hybrid For Sale | Reswell",
    description:
      "Browse hybrid for sale. Find shortboards, longboards, grovelers, and more from local surfers on Reswell.",
    path: "/boards?type=hybrid",
  }, { variationOf: "boards", note: "/boards?type=hybrid (mid-length, funboard)" }),
  page("boards:type=groveler", "marketplace", "Boards — Grovelers", {
    title: "Groveler Surfboards For Sale | Reswell",
    description:
      "Buy and sell groveler surfboards. Find small wave boards perfect for small days. Browse listings near you or from sellers that offer shipping on Reswell.",
    path: "/boards?type=groveler",
    ogImageUrl:
      "https://lqwsewptsirsglasnwmn.supabase.co/storage/v1/object/public/seo-assets/share-images/5183bacb-7f9b-4646-a4d0-467216d1229c.jpg",
  }, { variationOf: "boards", note: "/boards?type=groveler" }),
  page("boards:type=fish", "marketplace", "Boards — Fish", {
    title: "Fish For Sale | Reswell",
    description:
      "Browse fish surfboards for sale. Find shortboards, longboards, grovelers, and more from local surfers on Reswell.",
    path: "/boards?type=fish",
  }, { variationOf: "boards", note: "/boards?type=fish" }),
  page("boards:type=asym", "marketplace", "Boards — Asym", {
    title: "Asym For Sale | Reswell",
    description:
      "Browse asymmetric surfboards for sale. Find shortboards, longboards, grovelers, and more from local surfers on Reswell.",
    path: "/boards?type=asym",
  }, { variationOf: "boards", note: "/boards?type=asym" }),
  page("boards:type=step-up-gun", "marketplace", "Boards — Step-Up / Gun", {
    title: "Step-Up / Gun For Sale | Reswell",
    description:
      "Browse step-up / gun for sale. Find shortboards, longboards, grovelers, and more from local surfers on Reswell.",
    path: "/boards?type=step-up-gun",
  }, { variationOf: "boards", note: "/boards?type=step-up-gun" }),
  page("boards:type=other", "marketplace", "Boards — Other", {
    title: "Other boards For Sale | Reswell",
    description:
      "Browse other boards for sale. Find shortboards, longboards, grovelers, and more from local surfers on Reswell.",
    path: "/boards?type=other",
  }, { variationOf: "boards", note: "/boards?type=other" }),
  page("sold", "marketplace", "Recently sold", {
    title: "Recently sold surfboards | Reswell",
    description:
      "See surfboards that recently sold on Reswell — live marketplace activity and completed sales.",
    path: "/sold",
  }),
  page("map", "marketplace", "Sales map", {
    title: "Where Reswell orders flow | Sales map",
    description:
      "Explore where buyers and sellers connect across the United States — every completed Reswell order mapped by state.",
    path: "/map",
  }),
  page("search-recent", "marketplace", "Recently listed", {
    title: "Recently listed surfboards | Reswell",
    description:
      "Browse the latest surfboard listings on Reswell — a curated feed from active sellers.",
    path: "/search/recent",
  }),
  page("brands", "marketplace", "Brands directory", {
    title: "Surf brands directory — Reswell",
    description: "Explore shapers and surfboard brands on Reswell — profiles from our catalog.",
    path: "/brands",
  }),
  page("sellers", "marketplace", "Sellers directory", {
    title: "Explore sellers — Reswell",
    description:
      "Explore surf sellers on Reswell — support fellow surfers and find shops near you or who ship to your area.",
    path: "/sellers",
  }),
  // ---- Content & community ----
  page("blog", "content", "Blog index", {
    title: "Surfboard Guides & Marketplace Tips | Reswell",
    description:
      "Expert guides on buying and selling surfboards, gear reviews, and marketplace tips. Find your perfect board and sell smarter.",
    path: "/blog",
    ogImageUrl:
      "https://lqwsewptsirsglasnwmn.supabase.co/storage/v1/object/public/seo-assets/share-images/40d8f792-d432-49e3-9f60-63a3ece41c87.jpg",
  }, { note: "Individual posts manage their own SEO in the Blog CMS." }),
  page("board-talk", "content", "Threads forum", {
    title: "Threads — Reswell",
    description: "Community posts, Q&A, and surfboard discussions — join the conversation.",
    path: "/threads",
  }),
  page("board-talk-reviews", "content", "Board reviews", {
    title: "Board Reviews — Threads · Reswell",
    description: "Community ratings and reviews for surfboard models in the Reswell catalog.",
    path: "/threads/reviews",
  }),
  page("jamboards", "content", "Jamboards", {
    title: "Jamboards Alternative — Reswell community",
    description:
      "Jamboards Alternative is where surfers connect on Reswell — browse Board Talk conversations, share stoke, and jump into community discussions.",
    path: "/jamboards",
  }),
  page("help", "content", "Help center", {
    title: "Help Center — Reswell",
    description:
      "Search articles and guides for buying, selling, and managing your Reswell account.",
    path: "/help",
  }),

  // ---- Trust & legal ----
  page("protection-policy", "trust", "Purchase Protection", {
    title: "Purchase Protection — Reswell",
    description:
      "Purchase Protection for buyers and sellers on Reswell: buyer refunds for covered problems on eligible purchases; sellers are not charged extra for protection — policy, exclusions, and claims.",
    path: "/protection-policy",
  }),
  page("safety", "trust", "Safety tips", {
    title: "Safety tips — Reswell",
    description:
      "Tips for buying and selling surf gear safely on Reswell, covering meetups, on platform payments, and spotting scams.",
    path: "/safety",
  }),
  page("shipping", "trust", "Shipping guide", {
    title: "Shipping guide — Reswell",
    description:
      "How to ship and receive boards, fins, wetsuits, and other gear on Reswell — packaging, pickup, labels, and what each side is responsible for.",
    path: "/shipping",
  }),
  page("return-policy", "trust", "Return policy", {
    title: "Return Policy — Reswell",
    description:
      "United States return policy for Reswell: defective and non-defective returns, 7-day window, no exchanges, refund timing, labels, and eligibility.",
    path: "/return-policy",
  }),
  page("terms", "trust", "Terms of Service", {
    title: "Terms of Service — Reswell",
    description: "Rules and guidelines for buying, selling, and using the Reswell surfboard marketplace.",
    path: "/terms",
  }),
  page("privacy", "trust", "Privacy Policy", {
    title: "Privacy Policy — Reswell",
    description:
      "How Reswell collects, uses, and protects your personal information on our peer to peer surfboard marketplace.",
    path: "/privacy",
  }),
  page("cookies", "trust", "Cookie Policy", {
    title: "Cookie Policy | Reswell",
    description:
      "Learn how Reswell uses cookies to improve your surfboard marketplace experience. View our privacy practices and manage your preferences.",
    path: "/cookies",
    ogImageUrl:
      "https://lqwsewptsirsglasnwmn.supabase.co/storage/v1/object/public/seo-assets/share-images/78869381-5245-47a6-9298-bc67cecccff6.jpg",
  }),
  page("mobile-terms", "trust", "Mobile Terms of Service", {
    title: "Mobile Terms of Service — Reswell",
    description:
      "Terms for Reswell SMS/text messaging: consent, message types, opt-out (STOP), support (HELP), carrier charges, and privacy.",
    path: "/mobile-terms",
  }),
  page("faq", "trust", "FAQ", {
    title: "FAQ — Reswell",
    description:
      "Frequently asked questions about buying, selling, fees, shipping, messages, and Purchase Protection on Reswell.",
    path: "/faq",
  }),

  // ---- Marketing & growth ----
  page("listyoursurfboard", "marketing", "List your surfboard", {
    title: "List your surfboard | Reswell",
    description:
      "List your surfboard on Reswell — reach surfers locally and nationwide with photos, messaging, and secure checkout. Free to post.",
    path: "/listyoursurfboard",
    ogImageUrl: "/images/marketing/list-your-surfboard-share.jpg",
  }),
  page("shipping-estimator", "marketing", "Shipping estimator", {
    title: "Shipping label cost estimator — Reswell",
    description:
      "Estimate US surfboard shipping label costs by ship-from ZIP, receiver ZIP, weight, and package dimensions with live carrier quotes.",
    path: "/shipping-estimator",
  }),
  page("ratereswell", "marketing", "Rate Reswell", {
    title: "Rate Reswell",
    description:
      "Share your experience with Reswell. Tell us what you think and help improve the marketplace.",
    path: "/ratereswell",
  }),
  page("reswellreviews", "marketing", "Reswell reviews", {
    title: "Reswell Reviews",
    description: "Read what surfers and sellers say about buying and selling on Reswell.",
    path: "/reswellreviews",
  }),
]

const MANAGED_PAGE_BY_KEY = new Map(MANAGED_PAGES.map((p) => [p.key, p]))

export function getManagedPage(key: string): ManagedPage | undefined {
  return MANAGED_PAGE_BY_KEY.get(key)
}

export function managedPageKeys(): string[] {
  return MANAGED_PAGES.map((p) => p.key)
}
