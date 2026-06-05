/**
 * Registry of the pages that matter for SEO. This is the single source of truth for each
 * page's default title/description/canonical/robots; the admin SEO panel edits *overrides*
 * (stored in `page_seo_overrides`) that are merged on top of these defaults at render time.
 *
 * To make a new page editable in the panel: add an entry here, then call
 * `resolvePageMetadata(key)` from its `generateMetadata`.
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
}

export interface ManagedPage {
  /** Stable key — never change once shipped (it joins to `page_seo_overrides.page_key`). */
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
    },
  }
}

export const MANAGED_PAGES: ManagedPage[] = [
  // ---- Core ----
  page("home", "core", "Homepage", {
    title: "Reswell — Buy & sell surfboards",
    description:
      "Peer-to-peer surfboard marketplace: list your board, browse local listings and sellers that offer shipping, and shop new items from verified sellers.",
    path: "/",
  }),
  page("about", "core", "About", {
    title: "About Reswell",
    description:
      "Reswell is the peer to peer marketplace built for surfers. Buy and sell boards and gear with checkout, messaging, shipping tools, and Purchase Protection.",
    path: "/about",
  }),
  page("what-is-reswell", "core", "What is Reswell", {
    title: "What is Reswell, Reswell",
    description:
      "Reswell is the peer to peer marketplace for surfers: buy and sell surfboards and gear, with checkout, messaging, shipping tools, and Purchase Protection.",
    path: "/what-is-reswell",
  }),
  page("contact", "core", "Contact", {
    title: "Contact — Reswell",
    description:
      "Reach Reswell support by email or through this page. Quick replies, private handling, and help with your account, purchases, and safety.",
    path: "/contact",
  }),

  // ---- Marketplace ----
  page("boards", "marketplace", "Browse boards", {
    title: "Surfboards For Sale | Reswell",
    description:
      "Browse surfboards for sale. Find shortboards, longboards, grovelers, and more from local surfers on Reswell.",
    path: "/boards",
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
  page("boards:type=shortboard", "marketplace", "Boards — Shortboards", {
    title: "Shortboards For Sale | Reswell",
    description:
      "Browse shortboards for sale. Find shortboards, longboards, grovelers, and more from local surfers on Reswell.",
    path: "/boards?type=shortboard",
  }, { variationOf: "boards", note: "/boards?type=shortboard" }),
  page("boards:type=longboard", "marketplace", "Boards — Longboards", {
    title: "Longboards For Sale | Reswell",
    description:
      "Browse longboards for sale. Find shortboards, longboards, grovelers, and more from local surfers on Reswell.",
    path: "/boards?type=longboard",
  }, { variationOf: "boards", note: "/boards?type=longboard" }),
  page("boards:type=hybrid", "marketplace", "Boards — Hybrid", {
    title: "Hybrid For Sale | Reswell",
    description:
      "Browse hybrid for sale. Find shortboards, longboards, grovelers, and more from local surfers on Reswell.",
    path: "/boards?type=hybrid",
  }, { variationOf: "boards", note: "/boards?type=hybrid (mid-length, funboard)" }),
  page("boards:type=groveler", "marketplace", "Boards — Grovelers", {
    title: "Groveler For Sale | Reswell",
    description:
      "Browse groveler for sale. Find shortboards, longboards, grovelers, and more from local surfers on Reswell.",
    path: "/boards?type=groveler",
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
  page("shop", "marketplace", "Shop (new gear)", {
    title: "New surf gear — Reswell Shop",
    description:
      "Buy new marketplace inventory from sellers on Reswell — checkout, messaging, and buyer protection in one place.",
    path: "/shop",
  }),
  page("sold", "marketplace", "Recently sold", {
    title: "Recently sold surfboards | Reswell",
    description:
      "See surfboards that recently sold on Reswell — live marketplace activity and completed sales.",
    path: "/sold",
  }),
  page("search-recent", "marketplace", "Recently listed", {
    title: "Recently listed surfboards | Reswell",
    description:
      "Browse the latest surfboard listings on Reswell — a curated feed from active sellers.",
    path: "/search/recent",
  }),
  page("categories", "marketplace", "Categories", {
    title: "Browse categories — Reswell",
    description:
      "Browse surfboard categories on Reswell — explore shapes and jump into live peer-to-peer listings from local sellers.",
    path: "/categories",
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
  page("surfers", "marketplace", "Surfers directory", {
    title: "Surfers directory — Reswell",
    description:
      "Explore surfer profiles on Reswell — stories, bios, and links to discover gear on the marketplace.",
    path: "/surfers",
  }),

  // ---- Content & community ----
  page("blog", "content", "Blog index", {
    title: "Blog — Reswell",
    description:
      "Stories and practical guides from Reswell on gear, culture, and the marketplace, for buyers and sellers.",
    path: "/blog",
  }, { note: "Individual posts manage their own SEO in the Blog CMS." }),
  page("collections", "content", "Collections", {
    title: "Collections — Reswell",
    description: "Editorial features, press, and surf stories on Reswell.",
    path: "/collections",
  }),
  page("board-talk", "content", "Board Talk forum", {
    title: "Board Talk — Reswell",
    description: "Community posts, Q&A, and surfboard discussions — join the conversation.",
    path: "/board-talk",
  }),
  page("board-talk-reviews", "content", "Board reviews", {
    title: "Board Reviews — Board Talk · Reswell",
    description: "Community ratings and reviews for surfboard models in the Reswell catalog.",
    path: "/board-talk/reviews",
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
      "How to ship and receive surfboards on Reswell, from packaging to pickup, labels, and what each side is responsible for.",
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
    title: "Cookie Policy — Reswell",
    description: "How Reswell uses cookies and similar technologies on the site.",
    path: "/cookies",
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
