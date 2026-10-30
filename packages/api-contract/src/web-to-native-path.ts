/** Host used in production emails and Universal Links / App Links. */
export const APP_LINK_HOST = "www.reswell.app"

/**
 * Android `pathPrefix` values claimed by the app. Prefix match — keep
 * {@link webHrefToNativePath} covering every path under these prefixes.
 */
export const APP_LINK_ANDROID_PATH_PREFIXES = [
  "/l",
  "/track",
  "/dashboard/purchases",
  "/dashboard/sales",
  "/dashboard/listings",
  "/dashboard/earnings",
  "/dashboard/offers",
  "/dashboard/orders",
  "/messages",
  "/inbox",
  "/following",
  "/favorites",
  "/sellers",
  "/checkout",
  "/cart",
  "/help",
  "/safety",
  "/protection-policy",
  "/shipping-estimator",
  "/dropoff",
] as const

/** AASA `components` entries (iOS 13+). */
export const APP_LINK_AASA_COMPONENTS: ReadonlyArray<{ "/": string; comment: string }> = [
  { "/": "/l/*", comment: "Listing PDP" },
  { "/": "/track/*", comment: "Package tracking" },
  { "/": "/dashboard/purchases", comment: "Purchases list" },
  { "/": "/dashboard/purchases/*", comment: "Purchase detail" },
  { "/": "/dashboard/sales", comment: "Sales list" },
  { "/": "/dashboard/sales/*", comment: "Sale detail" },
  { "/": "/dashboard/listings", comment: "Seller listings" },
  { "/": "/dashboard/listings/*", comment: "Edit listing" },
  { "/": "/dashboard/earnings", comment: "Earnings" },
  { "/": "/dashboard/offers", comment: "Offers" },
  { "/": "/dashboard/orders", comment: "Legacy purchases list" },
  { "/": "/dashboard/orders/*", comment: "Legacy purchase detail" },
  { "/": "/messages", comment: "Inbox" },
  { "/": "/messages/*", comment: "Conversation" },
  { "/": "/inbox", comment: "Inbox" },
  { "/": "/following", comment: "Following" },
  { "/": "/favorites", comment: "Favorites" },
  { "/": "/sellers", comment: "Sellers directory" },
  { "/": "/sellers/*", comment: "Seller profile" },
  { "/": "/checkout", comment: "Checkout" },
  { "/": "/cart", comment: "Cart" },
  { "/": "/help", comment: "Help Center" },
  { "/": "/help/*", comment: "Help topics and articles" },
  { "/": "/safety", comment: "Safety tips" },
  { "/": "/protection-policy", comment: "Purchase Protection" },
  { "/": "/shipping-estimator", comment: "Shipping estimator" },
  { "/": "/dropoff/*", comment: "Drop-off landings" },
]

/** AASA `paths` entries for iOS 12 and earlier. */
export const APP_LINK_AASA_PATHS: readonly string[] = APP_LINK_AASA_COMPONENTS.map(
  (component) => component["/"],
)

export type HrefPathAndSearch = {
  pathname: string
  search: string
}

/**
 * Split a universal link, custom-scheme URL, or path into pathname + search.
 * `reswell://listing/abc` becomes `/listing/abc`.
 */
export function hrefPathAndSearch(raw: string): HrefPathAndSearch {
  const trimmed = raw.trim()
  if (!trimmed) return { pathname: "/", search: "" }

  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
      const url = new URL(trimmed)
      if (url.protocol === "http:" || url.protocol === "https:") {
        return { pathname: url.pathname || "/", search: url.search }
      }
      const pathname = url.hostname
        ? `/${url.hostname}${url.pathname === "/" ? "" : url.pathname}`
        : url.pathname || "/"
      return { pathname, search: url.search }
    }
  } catch {
    // Fall through to path parsing.
  }

  const q = trimmed.indexOf("?")
  const pathPart = q === -1 ? trimmed : trimmed.slice(0, q)
  const search = q === -1 ? "" : trimmed.slice(q)
  const pathname = pathPart.startsWith("/") ? pathPart : `/${pathPart}`
  return { pathname, search }
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const ORDER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const HELP_TOPIC_IDS = new Set(["buying", "selling", "accounts"])

function mapPathname(pathname: string): string | null {
  const listing = pathname.match(/^\/l\/([^/]+)$/)
  if (listing?.[1]) return `/listing/${decodeSegment(listing[1])}`

  const track = pathname.match(/^\/track\/([^/]+)$/)
  if (track?.[1]) {
    const orderId = decodeSegment(track[1])
    if (ORDER_ID_RE.test(orderId)) return `/track/${orderId}`
    return null
  }

  const sale = pathname.match(/^\/dashboard\/sales(?:\/([^/]+))?$/)
  if (sale) {
    return sale[1] ? `/account/sales/${decodeSegment(sale[1])}` : "/account/sales"
  }

  const purchase = pathname.match(/^\/dashboard\/purchases(?:\/([^/]+))?$/)
  if (purchase) {
    return purchase[1] ? `/account/purchases/${decodeSegment(purchase[1])}` : "/account/purchases"
  }

  const legacyOrder = pathname.match(/^\/dashboard\/orders(?:\/([^/]+))?$/)
  if (legacyOrder) {
    return legacyOrder[1]
      ? `/account/purchases/${decodeSegment(legacyOrder[1])}`
      : "/account/purchases"
  }

  const listingEdit = pathname.match(/^\/dashboard\/listings\/([^/]+)\/edit$/)
  if (listingEdit?.[1]) return `/sell/edit/${decodeSegment(listingEdit[1])}`

  const listingManage = pathname.match(/^\/dashboard\/listings\/([^/]+)$/)
  if (listingManage?.[1]) return `/sell/edit/${decodeSegment(listingManage[1])}`

  const sellEdit = pathname.match(/^\/sell\/edit\/([^/]+)$/)
  if (sellEdit?.[1]) return `/sell/edit/${decodeSegment(sellEdit[1])}`

  if (pathname === "/dashboard/listings") return "/account/listings"
  if (pathname === "/dashboard/earnings") return "/account/earnings"
  if (pathname === "/dashboard/offers") return "/account/offers"

  const thread = pathname.match(/^\/messages\/([^/]+)$/)
  if (thread?.[1]) return `/account/messages/${decodeSegment(thread[1])}`
  if (pathname === "/messages" || pathname === "/inbox") return "/inbox"

  if (pathname === "/following") return "/account/following"
  if (pathname === "/favorites") return "/favorites"

  const seller = pathname.match(/^\/sellers(?:\/([^/]+))?$/)
  if (seller) return pathname

  if (pathname === "/checkout") return "/account/checkout"
  if (pathname === "/cart") return "/account/cart"

  if (pathname === "/help") return "/help"
  const helpArticle = pathname.match(/^\/help\/([^/]+)\/([^/]+)$/)
  if (helpArticle?.[1] && helpArticle[2] && HELP_TOPIC_IDS.has(helpArticle[1])) {
    return `/help/${helpArticle[1]}/${decodeSegment(helpArticle[2])}`
  }
  const helpTopic = pathname.match(/^\/help\/([^/]+)$/)
  if (helpTopic?.[1] && HELP_TOPIC_IDS.has(helpTopic[1])) {
    return `/help/${helpTopic[1]}`
  }

  if (pathname === "/safety") return "/safety"
  if (pathname === "/protection-policy") return "/protection-policy"
  if (pathname === "/shipping-estimator") return "/shipping-estimator"
  if (pathname === "/dropoff/santa-barbara") return "/dropoff/santa-barbara"
  if (pathname === "/for-surf-shops") return "/seller-resources/for-surf-shops"
  if (pathname === "/seller-resources") return "/seller-resources/seller-resources"
  if (pathname === "/seller-resources/how-to-sell") return "/seller-resources/how-to-sell"
  if (pathname === "/seller-resources/how-to-ship") return "/seller-resources/how-to-ship"
  if (pathname === "/map") return "/seller-resources/sales-map"
  if (pathname === "/auth/login" || pathname === "/auth/sign-up") return "/sign-in"
  if (pathname === "/sell" || pathname === "/sell/new") return "/sell/new"
  if (pathname.startsWith("/sell/")) return "/sell/new"
  if (pathname === "/support" || pathname === "/dashboard/support") return "/account/support"
  if (pathname === "/account/support" || pathname.startsWith("/account/support/")) return pathname
  if (pathname.startsWith("/seller-resources/")) return pathname

  return null
}

/**
 * Map a website (or email) href onto an Expo Router path.
 * Returns null when the app should not handle the URL (leave it on the web).
 */
export function webHrefToNativePath(href: string | null | undefined): string | null {
  if (!href?.trim()) return null
  const { pathname, search } = hrefPathAndSearch(href)
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null
  const mapped = mapPathname(pathname)
  if (!mapped) return null
  return `${mapped}${search}`
}

function isHttpUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw.trim())
}

/**
 * Expo CLI / QR opens `reswell://expo-development-client?url=http://…`.
 * Native already consumed that to load Metro — Expo Router must not treat it as a screen.
 */
function isExpoDevelopmentClientUrl(raw: string, pathname: string): boolean {
  return `${raw}\n${pathname}`.toLowerCase().includes("expo-development-client")
}

/**
 * Expo Router `+native-intent` entry. Rewrites claimed website URLs; passes
 * native paths through; sends unknown https links to home instead of a 404.
 */
export function nativeIntentPath(raw: string): string {
  const { pathname, search } = hrefPathAndSearch(raw)
  if (isExpoDevelopmentClientUrl(raw, pathname)) return "/"
  const mapped = webHrefToNativePath(raw)
  if (mapped) return mapped
  if (isHttpUrl(raw)) return "/"
  if (pathname && pathname !== "/") return `${pathname}${search}`
  return raw.trim() || "/"
}
