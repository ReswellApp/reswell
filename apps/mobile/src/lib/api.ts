import Constants from "expo-constants"
import { publicApiUrl } from "@/lib/public-env"
import {
  mobileCartResultSchema,
  mobileCartSchema,
  mobileConversationDetailSchema,
  mobileConversationsSchema,
  mobileFavoriteResultSchema,
  mobileFavoritesSchema,
  mobileFollowResultSchema,
  mobileFollowingSchema,
  mobileListingDetailSchema,
  mobileListingsPageSchema,
  mobileMeSchema,
  mobileMessageResultSchema,
  mobileOfferActionResultSchema,
  mobileOffersSchema,
  mobileOrdersSchema,
  mobileProfileSchema,
  mobileReviewsPageSchema,
  mobileSalesSchema,
  type MobileCart,
  type MobileCartResult,
  type MobileConversationDetail,
  type MobileConversationPreview,
  type MobileFavorite,
  type MobileFavoriteResult,
  type MobileFollowResult,
  type MobileFollowing,
  type MobileListingDetail,
  type MobileListingsPage,
  type MobileMe,
  type MobileMessageResult,
  type MobileOffer,
  type MobileOfferActionBody,
  type MobileOfferActionResult,
  type MobileOrder,
  type MobileProfile,
  type MobileReviewsPage,
  type MobileSale,
} from "@reswell/api-contract"

/** Metro's host, so a phone can reach the Next server on this Mac instead of its own localhost. */
function packagerHostname(): string | null {
  const hostUri = Constants.expoConfig?.hostUri
  if (!hostUri) return null
  const host = hostUri.split(":")[0]?.trim()
  if (!host || host === "localhost" || host === "127.0.0.1") return null
  return host
}

function apiOrigin(): string {
  const configured = publicApiUrl()
  const withProtocol = /^https?:\/\//i.test(configured) ? configured : `http://${configured}`
  let url: URL
  try {
    url = new URL(withProtocol)
  } catch {
    return "http://localhost:3000"
  }
  if (__DEV__ && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
    const host = packagerHostname()
    if (host) url.hostname = host
  }
  return url.origin
}

async function getJson(path: string, accessToken?: string | null, payload?: unknown): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (payload !== undefined) headers["Content-Type"] = "application/json"
  const response = await fetch(`${apiOrigin()}${path}`, {
    method: payload === undefined ? "GET" : "POST",
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Request failed"
    throw new Error(message)
  }
  if (!body || typeof body !== "object" || !("data" in body)) {
    throw new Error("Unexpected response")
  }
  return body.data
}

function read<T>(path: string, parse: (data: unknown) => T, accessToken?: string | null, body?: unknown): Promise<T> {
  return getJson(path, accessToken, body).then(parse)
}

export function fetchListings(
  offset = 0,
  query?: { q?: string; section?: string; category?: string; board_type?: string },
): Promise<MobileListingsPage> {
  const params = new URLSearchParams({ limit: "20", offset: String(offset) })
  if (query?.q) params.set("q", query.q)
  if (query?.section) params.set("section", query.section)
  if (query?.category) params.set("category", query.category)
  if (query?.board_type) params.set("board_type", query.board_type)
  return read(`/api/mobile/v1/listings?${params.toString()}`, (data) => mobileListingsPageSchema.parse(data))
}

export function fetchProfileListings(
  slug: string,
  query?: { offset?: number; status?: "current" | "sold" },
): Promise<MobileListingsPage> {
  const params = new URLSearchParams({
    limit: "20",
    offset: String(query?.offset ?? 0),
    status: query?.status ?? "current",
  })
  return read(`/api/mobile/v1/profiles/${encodeURIComponent(slug)}/listings?${params.toString()}`, (data) =>
    mobileListingsPageSchema.parse(data),
  )
}

export function fetchProfileReviews(slug: string, offset = 0): Promise<MobileReviewsPage> {
  return read(
    `/api/mobile/v1/profiles/${encodeURIComponent(slug)}/reviews?limit=20&offset=${offset}`,
    (data) => mobileReviewsPageSchema.parse(data),
  )
}

export function fetchListing(id: string, accessToken?: string | null): Promise<MobileListingDetail> {
  return getJson(`/api/mobile/v1/listings/${encodeURIComponent(id)}`, accessToken).then((data) =>
    mobileListingDetailSchema.parse(data),
  )
}

export function fetchProfile(slug: string, accessToken?: string | null): Promise<MobileProfile> {
  return getJson(`/api/mobile/v1/profiles/${encodeURIComponent(slug)}`, accessToken).then((data) =>
    mobileProfileSchema.parse(data),
  )
}

export function setFavorite(
  accessToken: string,
  listingId: string,
  favorited: boolean,
): Promise<MobileFavoriteResult> {
  return read("/api/mobile/v1/me/favorites", (data) => mobileFavoriteResultSchema.parse(data), accessToken, {
    listing_id: listingId,
    favorited,
  })
}

export function setFollow(accessToken: string, sellerId: string, following: boolean): Promise<MobileFollowResult> {
  return read("/api/mobile/v1/me/following", (data) => mobileFollowResultSchema.parse(data), accessToken, {
    seller_id: sellerId,
    following,
  })
}

export function setCartItem(accessToken: string, listingId: string, quantity: number): Promise<MobileCartResult> {
  return read("/api/mobile/v1/me/cart", (data) => mobileCartResultSchema.parse(data), accessToken, {
    listing_id: listingId,
    quantity,
  })
}

export function sendListingMessage(
  accessToken: string,
  listingId: string,
  body: string,
): Promise<MobileMessageResult> {
  return read(
    `/api/mobile/v1/listings/${encodeURIComponent(listingId)}/messages`,
    (data) => mobileMessageResultSchema.parse(data),
    accessToken,
    { body },
  )
}

export function sendConversationMessage(
  accessToken: string,
  conversationId: string,
  body: string,
): Promise<MobileMessageResult> {
  return read(
    `/api/mobile/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
    (data) => mobileMessageResultSchema.parse(data),
    accessToken,
    { body },
  )
}

export function actOnOffer(
  accessToken: string,
  offerId: string,
  body: MobileOfferActionBody,
): Promise<MobileOfferActionResult> {
  return read(
    `/api/mobile/v1/me/offers/${encodeURIComponent(offerId)}`,
    (data) => mobileOfferActionResultSchema.parse(data),
    accessToken,
    body,
  )
}

export function fetchMe(accessToken: string): Promise<MobileMe> {
  return read("/api/mobile/v1/me", (data) => mobileMeSchema.parse(data), accessToken)
}

export function fetchFavorites(accessToken: string): Promise<{ favorites: MobileFavorite[] }> {
  return read("/api/mobile/v1/me/favorites", (data) => mobileFavoritesSchema.parse(data), accessToken)
}

export function fetchFollowing(accessToken: string): Promise<MobileFollowing> {
  return read("/api/mobile/v1/me/following", (data) => mobileFollowingSchema.parse(data), accessToken)
}

export function fetchCart(accessToken: string): Promise<MobileCart> {
  return read("/api/mobile/v1/me/cart", (data) => mobileCartSchema.parse(data), accessToken)
}

export function fetchOffers(accessToken: string): Promise<{ offers: MobileOffer[] }> {
  return read("/api/mobile/v1/me/offers", (data) => mobileOffersSchema.parse(data), accessToken)
}

export function fetchPurchases(accessToken: string): Promise<{ orders: MobileOrder[] }> {
  return read("/api/mobile/v1/me/purchases", (data) => mobileOrdersSchema.parse(data), accessToken)
}

export function fetchSales(accessToken: string): Promise<{ sales: MobileSale[] }> {
  return read("/api/mobile/v1/me/sales", (data) => mobileSalesSchema.parse(data), accessToken)
}

export function fetchConversations(accessToken: string): Promise<{ conversations: MobileConversationPreview[] }> {
  return read("/api/mobile/v1/me/conversations", (data) => mobileConversationsSchema.parse(data), accessToken)
}

export function fetchConversation(id: string, accessToken: string): Promise<MobileConversationDetail> {
  return read(
    `/api/mobile/v1/conversations/${encodeURIComponent(id)}`,
    (data) => mobileConversationDetailSchema.parse(data),
    accessToken,
  )
}
