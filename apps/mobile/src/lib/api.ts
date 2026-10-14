import Constants from "expo-constants"
import { isDevice } from "expo-device"
import { Platform } from "react-native"
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
  mobileBrowseRailSchema,
  mobileSellerResourceSchema,
  mobileCategorySchema,
  mobileHomeSchema,
  mobileMarketplaceFeedSchema,
  mobileListingDetailSchema,
  mobileListingsPageSchema,
  mobileMeSchema,
  mobileMessageResultSchema,
  mobileOfferActionResultSchema,
  mobileOffersSchema,
  mobileOrdersSchema,
  mobileProfileSchema,
  mobileRecentlyViewedSchema,
  mobileReviewsPageSchema,
  mobileSalesSchema,
  mobileSellBoardSpecsSchema,
  mobileSellCatalogSearchSchema,
  mobileSellDropoffLocationsSchema,
  mobileSellTaxonomySchema,
  mobilePlaceDetailsSchema,
  mobilePlaceSuggestionsSchema,
  type MobileBrowseRail,
  type MobileSellerResource,
  type MobileCategory,
  type MobileCategoryListingsQuery,
  type MobileCart,
  type MobileCartResult,
  type MobileConversationDetail,
  type MobileConversationPreview,
  type MobileFavorite,
  type MobileFavoriteResult,
  type MobileFollowResult,
  type MobileFollowing,
  type MobileHome,
  type MobileListingDetail,
  type MobileMarketplaceFeed,
  type MobileMarketplaceFeedTab,
  type MobileListingsPage,
  type MobileMe,
  type MobileMessageResult,
  type MobileOffer,
  type MobileOfferActionBody,
  type MobileOfferActionResult,
  type MobileOrder,
  type MobileProfile,
  type MobileRecentlyViewed,
  type MobileReviewsPage,
  type MobileSale,
  type MobileSellBoardSpecs,
  type MobileSellCatalogSearch,
  type MobileSellDropoffLocations,
  type MobileSellTaxonomy,
  type MobilePlaceDetails,
  type MobilePlaceSuggestions,
} from "@reswell/api-contract"

/** Metro's host, so a physical phone can reach the Next server on this Mac. */
function packagerHostname(): string | null {
  const hostUri = Constants.expoConfig?.hostUri
  if (!hostUri) return null
  const host = hostUri.split(":")[0]?.trim()
  if (!host || host === "localhost" || host === "127.0.0.1") return null
  return host
}

/**
 * The iOS simulator shares this Mac's localhost. A physical phone does not, so it
 * uses the Metro host. The Android emulator reaches the host at 10.0.2.2.
 */
function devApiHostname(): string | null {
  if (Platform.OS === "web") return null
  if (!isDevice && Platform.OS === "ios") return null
  if (!isDevice && Platform.OS === "android") return "10.0.2.2"
  return packagerHostname()
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
    const host = devApiHostname()
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

export function fetchHome(): Promise<MobileHome> {
  return read("/api/mobile/v1/home", (data) => mobileHomeSchema.parse(data))
}

/** Website category rail and Seller Resources dropdown. Refetched on each home visit. */
export function fetchBrowseRail(): Promise<MobileBrowseRail> {
  return read("/api/mobile/v1/browse-rail", (data) => mobileBrowseRailSchema.parse(data))
}

/** Seller resource page. Copy comes from the same source as the website. */
export function fetchSellerResource(slug: string): Promise<MobileSellerResource> {
  return read(`/api/mobile/v1/seller-resources/${encodeURIComponent(slug)}`, (data) =>
    mobileSellerResourceSchema.parse(data),
  )
}

export function fetchMarketplaceFeed(query?: {
  tab?: MobileMarketplaceFeedTab
  page?: number
  sold_at?: string
  listing_id?: string
}): Promise<MobileMarketplaceFeed> {
  const params = new URLSearchParams()
  if (query?.tab) params.set("tab", query.tab)
  if (query?.page && query.page > 1) params.set("page", String(query.page))
  if (query?.sold_at && query.listing_id) {
    params.set("sold_at", query.sold_at)
    params.set("listing_id", query.listing_id)
  }
  const search = params.toString()
  return read(`/api/mobile/v1/feed${search ? `?${search}` : ""}`, (data) =>
    mobileMarketplaceFeedSchema.parse(data),
  )
}

export function fetchRecentlyViewed(accessToken: string): Promise<MobileRecentlyViewed> {
  return read(
    "/api/mobile/v1/me/recently-viewed",
    (data) => mobileRecentlyViewedSchema.parse(data),
    accessToken,
  )
}

export function fetchCategory(slug: string): Promise<MobileCategory> {
  return read(`/api/mobile/v1/categories/${encodeURIComponent(slug)}`, (data) => mobileCategorySchema.parse(data))
}

export function fetchCategoryListings(
  slug: string,
  query: Partial<MobileCategoryListingsQuery> & { offset?: number },
): Promise<MobileListingsPage> {
  const params = new URLSearchParams()
  if (query.offset) params.set("offset", String(query.offset))
  if (query.sort) params.set("sort", query.sort)
  if (query.shipping) params.set("shipping", query.shipping)
  if (query.type) params.set("type", query.type)
  for (const key of ["style", "condition", "fin", "finSystem", "construction", "length", "volume", "size", "kind", "location", "radius"] as const) {
    const value = query[key]
    if (value) params.set(key, value)
  }
  if (query.lat != null && query.lng != null) {
    params.set("lat", String(query.lat))
    params.set("lng", String(query.lng))
  }
  const search = params.toString()
  return read(
    `/api/mobile/v1/categories/${encodeURIComponent(slug)}/listings${search ? `?${search}` : ""}`,
    (data) => mobileListingsPageSchema.parse(data),
  )
}

export type PlaceSuggestion = {
  label: string
  lat: number
  lng: number
}

/** Website city/ZIP suggestions (`/api/geocode/suggest`). */
export async function fetchPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const response = await fetch(`${apiOrigin()}/api/geocode/suggest?q=${encodeURIComponent(q)}`, {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) return []
  const body: unknown = await response.json()
  if (!body || typeof body !== "object" || !("suggestions" in body) || !Array.isArray(body.suggestions)) return []
  return body.suggestions.flatMap((row) => {
    if (!row || typeof row !== "object") return []
    const suggestion = row as Record<string, unknown>
    if (typeof suggestion.label !== "string" || typeof suggestion.lat !== "number" || typeof suggestion.lng !== "number") {
      return []
    }
    return [{ label: suggestion.label, lat: suggestion.lat, lng: suggestion.lng }]
  })
}

/** Website reverse geocode (`/api/geocode?lat=&lng=`). */
export async function reverseGeocodeLabel(lat: number, lng: number): Promise<string | null> {
  const response = await fetch(`${apiOrigin()}/api/geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`, {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) return null
  const body: unknown = await response.json()
  if (!body || typeof body !== "object" || !("displayName" in body) || typeof body.displayName !== "string") return null
  const label = body.displayName.trim()
  return label || null
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

/** Sell categories and surfboard board-style subcategories. */
export function fetchSellTaxonomy(): Promise<MobileSellTaxonomy> {
  return read("/api/mobile/v1/sell/taxonomy", (data) => mobileSellTaxonomySchema.parse(data))
}

/** Google place dropdown for the sell location field. Falls back to city/ZIP search on the server. */
export function fetchSellPlaceSuggestions(query: string): Promise<MobilePlaceSuggestions> {
  const q = query.trim()
  if (q.length < 2) return Promise.resolve({ suggestions: [] })
  return read(`/api/mobile/v1/places/suggest?q=${encodeURIComponent(q)}`, (data) =>
    mobilePlaceSuggestionsSchema.parse(data),
  )
}

/** City, state, and coordinates for a Google suggestion. */
export function fetchSellPlaceDetails(placeId: string): Promise<MobilePlaceDetails> {
  return read(`/api/mobile/v1/places/details?place_id=${encodeURIComponent(placeId)}`, (data) =>
    mobilePlaceDetailsSchema.parse(data),
  )
}

/** Surfboard length, width, thickness, volume, fins, and construction. Same lists as `/sell`. */
export function fetchSellBoardSpecs(): Promise<MobileSellBoardSpecs> {
  return read("/api/mobile/v1/sell/board-specs", (data) => mobileSellBoardSpecsSchema.parse(data))
}

/** Surfboard drop-off cities. Same list as the website sell flow. */
export function fetchSellDropoffLocations(): Promise<MobileSellDropoffLocations> {
  return read("/api/mobile/v1/sell/dropoff-locations", (data) => mobileSellDropoffLocationsSchema.parse(data))
}

export type StructuredPlace = {
  label: string
  city: string
  state: string
}

/** Website reverse geocode (`/api/geocode/structured`). Google first. */
export async function fetchStructuredPlace(lat: number, lng: number): Promise<StructuredPlace | null> {
  const response = await fetch(
    `${apiOrigin()}/api/geocode/structured?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
    { headers: { Accept: "application/json" } },
  )
  if (!response.ok) return null
  const body: unknown = await response.json()
  if (!body || typeof body !== "object") return null
  const row = body as { city_locality?: unknown; state_province?: unknown }
  const city = typeof row.city_locality === "string" ? row.city_locality.trim() : ""
  const state = typeof row.state_province === "string" ? row.state_province.trim() : ""
  if (!city || !state) return null
  return { label: `${city}, ${state}`, city, state }
}

/** Brand and model catalog search. Same index as the website sell flow. */
export function fetchSellCatalog(query: string): Promise<MobileSellCatalogSearch> {
  const params = new URLSearchParams({ q: query.trim() })
  return read(`/api/mobile/v1/sell/catalog-search?${params.toString()}`, (data) =>
    mobileSellCatalogSearchSchema.parse(data),
  )
}

export function fetchConversation(id: string, accessToken: string): Promise<MobileConversationDetail> {
  return read(
    `/api/mobile/v1/conversations/${encodeURIComponent(id)}`,
    (data) => mobileConversationDetailSchema.parse(data),
    accessToken,
  )
}
