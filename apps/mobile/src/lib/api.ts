import Constants from "expo-constants"
import { isDevice } from "expo-device"
import { Platform } from "react-native"
import { notifyCartChanged } from "@/lib/cart-count-events"
import { publicApiUrl } from "@/lib/public-env"
import type { SellDraft, SellPhoto } from "@/lib/sell-flow"
import {
  mobileCartResultSchema,
  mobileCashOutResultSchema,
  mobileDashboardSchema,
  mobileEarningsSchema,
  mobilePayoutOnboardingSchema,
  mobileCartSchema,
  mobileCheckoutAddressesSchema,
  mobileCheckoutConfigSchema,
  mobileCheckoutFinalizeSchema,
  mobileCheckoutPaymentSchema,
  mobileCheckoutQuoteSchema,
  mobileConversationDetailSchema,
  mobileConversationsSchema,
  mobileFavoriteResultSchema,
  mobileFavoritesSchema,
  mobileFollowResultSchema,
  mobileFollowingSchema,
  mobileBrandPageSchema,
  mobileBrandsPageSchema,
  mobileBrowseRailSchema,
  mobileSellerResourceSchema,
  mobileCategorySchema,
  mobileHomeSchema,
  mobileInboxSchema,
  mobileMarketplaceFeedSchema,
  mobileListingActionResultSchema,
  mobileListingDetailSchema,
  mobileMyListingsSchema,
  mobileListingRailsSchema,
  mobileListingsPageSchema,
  mobileMeSchema,
  mobileModelPageSchema,
  mobileMessageResultSchema,
  mobileOfferActionResultSchema,
  mobileOffersSchema,
  mobileOrdersSchema,
  mobileProfileAvatarResultSchema,
  mobileProfileBannerResultSchema,
  mobileProfileSchema,
  mobileProfileSignInActionSchema,
  mobileProfileSettingsSchema,
  mobileSellerPageSchema,
  mobileSellersPageSchema,
  mobileRecentlyViewedSchema,
  mobileReviewsPageSchema,
  mobileSavedSearchSchema,
  mobileSearchResultsSchema,
  mobileSearchSchema,
  mobileBalanceSheetSchema,
  mobileSaleDetailSchema,
  mobileSaleLabelSchema,
  mobileSalesSchema,
  mobileShipperActionResultSchema,
  mobileShipperSchema,
  mobileShopifyActionResultSchema,
  mobileShopifySchema,
  mobileSupportCasesSchema,
  mobileSupportCreateResultSchema,
  mobileSupportReplyResultSchema,
  mobileSupportThreadSchema,
  mobileSellBoardSpecsSchema,
  mobileSellCatalogSearchSchema,
  mobileSellDropoffLocationsSchema,
  mobileSellPhotoSchema,
  mobileSellPublishResultSchema,
  mobileSellTaxonomySchema,
  mobilePlaceDetailsSchema,
  mobilePlaceSuggestionsSchema,
  type MobileBrandPage,
  type MobileBrandsPage,
  type MobileBrowseRail,
  type MobileSellerPage,
  type MobileSellersPage,
  type MobileSellerResource,
  type MobileCategory,
  type MobileCategoryListingsQuery,
  type MobileCart,
  type MobileCheckoutAddresses,
  type MobileCheckoutConfig,
  type MobileCheckoutFinalize,
  type MobileCheckoutPayment,
  type MobileCheckoutQuote,
  type MobileCashOutResult,
  type MobileDashboard,
  type MobileEarnings,
  type MobileCartResult,
  type MobileConversationDetail,
  type MobileConversationPreview,
  type MobileFavorite,
  type MobileFavoriteResult,
  type MobileFollowResult,
  type MobileFollowing,
  type MobileHome,
  type MobileInbox,
  type MobileListingDetail,
  type MobileMyListings,
  type MobileListingRails,
  type MobileMarketplaceFeed,
  type MobileMarketplaceFeedTab,
  type MobileListingsPage,
  type MobileMe,
  type MobileModelPage,
  type MobileMessageResult,
  type MobileOffer,
  type MobileOfferActionBody,
  type MobileOfferActionResult,
  type MobileOrder,
  type MobileProfile,
  type MobileProfileAvatarResult,
  type MobileProfileBannerResult,
  type MobileProfileEmail,
  type MobileProfilePassword,
  type MobileProfileSettings,
  type MobileProfileSignInAction,
  type MobileProfileSettingsPatch,
  type MobileRecentlyViewed,
  type MobileReviewsPage,
  type MobileSavedSearch,
  type MobileSearch,
  type MobileSearchResults,
  type MobileBalanceSheet,
  type MobileSale,
  type MobileSaleDetail,
  type MobileShipper,
  type MobileShipperActionBody,
  type MobileShipperActionResult,
  type MobileShopify,
  type MobileShopifyActionBody,
  type MobileShopifyActionResult,
  type MobileSupportCases,
  type MobileSupportReplyResult,
  type MobileSupportThread,
  type MobileSellBoardSpecs,
  type MobileSellCatalogSearch,
  type MobileSellDropoffLocations,
  type MobileSellPhoto,
  type MobileSellPublishResult,
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

/** `/sellers`. Copy, order, and lines follow the website directory. */
export function fetchSellers(query?: string): Promise<MobileSellersPage> {
  const params = new URLSearchParams()
  const q = query?.trim()
  if (q) params.set("q", q)
  const path = params.size > 0 ? `/api/mobile/v1/sellers?${params.toString()}` : "/api/mobile/v1/sellers"
  return read(path, (data) => mobileSellersPageSchema.parse(data))
}

export function fetchBrands(): Promise<MobileBrandsPage> {
  return read("/api/mobile/v1/brands", (data) => mobileBrandsPageSchema.parse(data))
}

export function fetchBrand(slug: string): Promise<MobileBrandPage> {
  return read(`/api/mobile/v1/brands/${encodeURIComponent(slug)}`, (data) => mobileBrandPageSchema.parse(data))
}

export function fetchModel(brandSlug: string, modelSlug: string): Promise<MobileModelPage> {
  return read(
    `/api/mobile/v1/brands/${encodeURIComponent(brandSlug)}/models/${encodeURIComponent(modelSlug)}`,
    (data) => mobileModelPageSchema.parse(data),
  )
}

/** `/sellers/[slug]`. Profile and current listings from the same page as the website. */
export function fetchSeller(slug: string, accessToken?: string | null): Promise<MobileSellerPage> {
  return read(`/api/mobile/v1/sellers/${encodeURIComponent(slug)}`, (data) => mobileSellerPageSchema.parse(data), accessToken)
}

/** Seller resource page. Copy comes from the same source as the website. */
export function fetchSellerResource(slug: string): Promise<MobileSellerResource> {
  return read(`/api/mobile/v1/seller-resources/${encodeURIComponent(slug)}`, (data) =>
    mobileSellerResourceSchema.parse(data),
  )
}

export function fetchMarketplaceFeed(
  query?: {
    tab?: MobileMarketplaceFeedTab
    page?: number
    sold_at?: string
    listing_id?: string
  },
  accessToken?: string | null,
): Promise<MobileMarketplaceFeed> {
  const params = new URLSearchParams()
  if (query?.tab) params.set("tab", query.tab)
  if (query?.page && query.page > 1) params.set("page", String(query.page))
  if (query?.sold_at && query.listing_id) {
    params.set("sold_at", query.sold_at)
    params.set("listing_id", query.listing_id)
  }
  const search = params.toString()
  return read(
    `/api/mobile/v1/feed${search ? `?${search}` : ""}`,
    (data) => mobileMarketplaceFeedSchema.parse(data),
    accessToken,
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

/** Same ranking as the website header. Cards use absolute image URLs. */
export function fetchSearchSuggest(query: string): Promise<MobileSearch["listings"]> {
  const q = query.trim()
  if (q.length < 2) return Promise.resolve([])
  return read(`/api/mobile/v1/search?q=${encodeURIComponent(q)}`, (data) => mobileSearchSchema.parse(data).listings)
}

/** Same result set as the website `/search` page. */
export function fetchSearchResults(query: string): Promise<MobileSearchResults> {
  return read(`/api/mobile/v1/search/results?q=${encodeURIComponent(query.trim())}`, (data) =>
    mobileSearchResultsSchema.parse(data),
  )
}

export function fetchSavedSearch(accessToken: string, query: string): Promise<MobileSavedSearch> {
  return read(
    `/api/mobile/v1/me/saved-searches?q=${encodeURIComponent(query.trim())}`,
    (data) => mobileSavedSearchSchema.parse(data),
    accessToken,
  )
}

export function setSavedSearch(accessToken: string, query: string, saved: boolean): Promise<MobileSavedSearch> {
  return read("/api/mobile/v1/me/saved-searches", (data) => mobileSavedSearchSchema.parse(data), accessToken, {
    q: query.trim(),
    saved,
  })
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

export function fetchMyListings(accessToken: string): Promise<MobileMyListings> {
  return read("/api/mobile/v1/me/listings", (data) => mobileMyListingsSchema.parse(data), accessToken)
}

export function setListingVacation(
  accessToken: string,
  body: { enabled: boolean; listing_id?: string },
): Promise<{ message: string }> {
  return read(
    "/api/mobile/v1/me/listings/vacation",
    (data) => mobileListingActionResultSchema.parse(data),
    accessToken,
    body,
  )
}

export function relistListing(accessToken: string, listingId: string): Promise<{ message: string }> {
  return read(
    "/api/mobile/v1/me/listings/relist",
    (data) => mobileListingActionResultSchema.parse(data),
    accessToken,
    { listing_id: listingId },
  )
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

/** Same horizontal sections the website renders under `/l`. */
export function fetchListingRails(id: string, accessToken?: string | null): Promise<MobileListingRails> {
  return getJson(`/api/mobile/v1/listings/${encodeURIComponent(id)}/rails`, accessToken).then((data) =>
    mobileListingRailsSchema.parse(data),
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
  }).then((result) => {
    notifyCartChanged()
    return result
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

export function fetchProfileSettings(accessToken: string): Promise<MobileProfileSettings> {
  return read("/api/mobile/v1/me/profile", (data) => mobileProfileSettingsSchema.parse(data), accessToken)
}

export function saveProfileSettings(accessToken: string, body: MobileProfileSettingsPatch): Promise<MobileProfileSettings> {
  return read("/api/mobile/v1/me/profile", (data) => mobileProfileSettingsSchema.parse(data), accessToken, body)
}

export function changeProfileEmail(accessToken: string, body: MobileProfileEmail): Promise<MobileProfileSignInAction> {
  return read("/api/mobile/v1/me/profile/email", (data) => mobileProfileSignInActionSchema.parse(data), accessToken, body)
}

export function changeProfilePassword(accessToken: string, body: MobileProfilePassword): Promise<MobileProfileSignInAction> {
  return read(
    "/api/mobile/v1/me/profile/password",
    (data) => mobileProfileSignInActionSchema.parse(data),
    accessToken,
    body,
  )
}

export function sendProfilePasswordReset(accessToken: string): Promise<MobileProfileSignInAction> {
  return read(
    "/api/mobile/v1/me/profile/password-reset",
    (data) => mobileProfileSignInActionSchema.parse(data),
    accessToken,
    {},
  )
}

export async function uploadProfileAvatar(accessToken: string, uri: string): Promise<MobileProfileAvatarResult> {
  const form = new FormData()
  form.append("file", { uri, name: "avatar.jpg", type: "image/jpeg" } as unknown as Blob)
  const response = await fetch(`${apiOrigin()}/api/mobile/v1/me/profile/avatar`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    body: form,
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Upload failed"
    throw new Error(message)
  }
  if (!body || typeof body !== "object" || !("data" in body)) throw new Error("Unexpected response")
  return mobileProfileAvatarResultSchema.parse(body.data)
}

async function postProfilePhoto(accessToken: string, path: string, uri: string, name: string): Promise<unknown> {
  const form = new FormData()
  form.append("file", { uri, name, type: "image/jpeg" } as unknown as Blob)
  const response = await fetch(`${apiOrigin()}${path}`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    body: form,
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Upload failed"
    throw new Error(message)
  }
  if (!body || typeof body !== "object" || !("data" in body)) throw new Error("Unexpected response")
  return body.data
}

async function deleteProfilePhoto(accessToken: string, path: string): Promise<unknown> {
  const response = await fetch(`${apiOrigin()}${path}`, {
    method: "DELETE",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Unable to remove photo"
    throw new Error(message)
  }
  if (!body || typeof body !== "object" || !("data" in body)) throw new Error("Unexpected response")
  return body.data
}

export function uploadProfileBanner(accessToken: string, uri: string): Promise<MobileProfileBannerResult> {
  return postProfilePhoto(accessToken, "/api/mobile/v1/me/profile/banner", uri, "banner.jpg").then((data) =>
    mobileProfileBannerResultSchema.parse(data),
  )
}

export function removeProfileBanner(accessToken: string): Promise<MobileProfileBannerResult> {
  return deleteProfilePhoto(accessToken, "/api/mobile/v1/me/profile/banner").then((data) =>
    mobileProfileBannerResultSchema.parse(data),
  )
}

export function uploadProfileTileBanner(accessToken: string, uri: string): Promise<MobileProfileBannerResult> {
  return postProfilePhoto(accessToken, "/api/mobile/v1/me/profile/tile-banner", uri, "tile.jpg").then((data) =>
    mobileProfileBannerResultSchema.parse(data),
  )
}

export function removeProfileTileBanner(accessToken: string): Promise<MobileProfileBannerResult> {
  return deleteProfilePhoto(accessToken, "/api/mobile/v1/me/profile/tile-banner").then((data) =>
    mobileProfileBannerResultSchema.parse(data),
  )
}

export async function removeProfileAvatar(accessToken: string): Promise<MobileProfileAvatarResult> {
  const response = await fetch(`${apiOrigin()}/api/mobile/v1/me/profile/avatar`, {
    method: "DELETE",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Unable to remove photo"
    throw new Error(message)
  }
  if (!body || typeof body !== "object" || !("data" in body)) throw new Error("Unexpected response")
  return mobileProfileAvatarResultSchema.parse(body.data)
}

export function fetchMe(accessToken: string): Promise<MobileMe> {
  return read("/api/mobile/v1/me", (data) => mobileMeSchema.parse(data), accessToken)
}

export function fetchEarnings(accessToken: string): Promise<MobileEarnings> {
  return read("/api/mobile/v1/me/earnings", (data) => mobileEarningsSchema.parse(data), accessToken)
}

export function startPayoutOnboarding(accessToken: string): Promise<{ url: string }> {
  return read("/api/mobile/v1/me/earnings/onboarding", (data) => mobilePayoutOnboardingSchema.parse(data), accessToken, {})
}

export function cashOutEarnings(
  accessToken: string,
  body: { amount: number; speed: "standard" | "instant"; externalAccountId?: string },
): Promise<MobileCashOutResult> {
  return read("/api/mobile/v1/me/earnings/cash-out", (data) => mobileCashOutResultSchema.parse(data), accessToken, body)
}

export function fetchDashboard(accessToken: string): Promise<MobileDashboard> {
  return read("/api/mobile/v1/me/dashboard", (data) => mobileDashboardSchema.parse(data), accessToken)
}

export function fetchMyReviews(accessToken: string, offset = 0): Promise<MobileReviewsPage> {
  return read(
    `/api/mobile/v1/me/reviews?limit=20&offset=${offset}`,
    (data) => mobileReviewsPageSchema.parse(data),
    accessToken,
  )
}

export function fetchFollowers(accessToken: string): Promise<MobileFollowing> {
  return read("/api/mobile/v1/me/followers", (data) => mobileFollowingSchema.parse(data), accessToken)
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

export function fetchCheckoutConfig(accessToken: string): Promise<MobileCheckoutConfig> {
  return read("/api/mobile/v1/me/checkout", (data) => mobileCheckoutConfigSchema.parse(data), accessToken)
}

export function fetchCheckoutAddresses(accessToken: string): Promise<MobileCheckoutAddresses> {
  return read("/api/mobile/v1/me/checkout/addresses", (data) => mobileCheckoutAddressesSchema.parse(data), accessToken)
}

export function saveCheckoutAddress(
  accessToken: string,
  address: {
    full_name: string
    line1: string
    line2?: string
    city: string
    state?: string
    postal_code: string
    country?: string
    phone?: string
  },
): Promise<MobileCheckoutAddresses> {
  return read("/api/mobile/v1/me/checkout/addresses", (data) => mobileCheckoutAddressesSchema.parse(data), accessToken, address)
}

export function quoteCheckout(
  accessToken: string,
  body: { listing_ids: string[]; address_id: string; service_code?: string },
): Promise<MobileCheckoutQuote> {
  return read("/api/mobile/v1/me/checkout/quote", (data) => mobileCheckoutQuoteSchema.parse(data), accessToken, body)
}

export function startCheckoutPayment(
  accessToken: string,
  body: { listing_ids: string[]; fulfillment: "shipping" | "pickup"; address_id?: string; quote_token?: string },
): Promise<MobileCheckoutPayment> {
  return read("/api/mobile/v1/me/checkout/payment", (data) => mobileCheckoutPaymentSchema.parse(data), accessToken, body)
}

export function finalizeCheckout(accessToken: string, paymentIntentId: string): Promise<MobileCheckoutFinalize> {
  return read(
    "/api/mobile/v1/me/checkout/finalize",
    (data) => mobileCheckoutFinalizeSchema.parse(data),
    accessToken,
    { payment_intent_id: paymentIntentId },
  ).then((result) => {
    notifyCartChanged()
    return result
  })
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

export function fetchSale(accessToken: string, orderId: string): Promise<MobileSaleDetail> {
  return read(`/api/mobile/v1/me/sales/${encodeURIComponent(orderId)}`, (data) => mobileSaleDetailSchema.parse(data), accessToken)
}

export function fetchSaleLabel(accessToken: string, orderId: string): Promise<{ url: string }> {
  return read(
    `/api/mobile/v1/me/sales/${encodeURIComponent(orderId)}/label`,
    (data) => mobileSaleLabelSchema.parse(data),
    accessToken,
  )
}

export function fetchSupportCases(accessToken: string): Promise<MobileSupportCases> {
  return read("/api/mobile/v1/me/support", (data) => mobileSupportCasesSchema.parse(data), accessToken)
}

export function openSupportCase(accessToken: string, body: { subject: string; body: string }): Promise<{ id: string }> {
  return read("/api/mobile/v1/me/support", (data) => mobileSupportCreateResultSchema.parse(data), accessToken, body)
}

export function fetchSupportThread(accessToken: string, caseId: string): Promise<MobileSupportThread> {
  return read(
    `/api/mobile/v1/me/support/${encodeURIComponent(caseId)}`,
    (data) => mobileSupportThreadSchema.parse(data),
    accessToken,
  )
}

export function replySupportCase(accessToken: string, caseId: string, body: string): Promise<MobileSupportReplyResult> {
  return read(
    `/api/mobile/v1/me/support/${encodeURIComponent(caseId)}`,
    (data) => mobileSupportReplyResultSchema.parse(data),
    accessToken,
    { body },
  )
}

export function fetchShipper(accessToken: string): Promise<MobileShipper> {
  return read("/api/mobile/v1/me/shipper", (data) => mobileShipperSchema.parse(data), accessToken)
}

export function actOnShipper(accessToken: string, body: MobileShipperActionBody): Promise<MobileShipperActionResult> {
  return read("/api/mobile/v1/me/shipper", (data) => mobileShipperActionResultSchema.parse(data), accessToken, body)
}

export function fetchBalanceSheet(accessToken: string, page = 1): Promise<MobileBalanceSheet> {
  return read(
    `/api/mobile/v1/me/balance-sheet?page=${encodeURIComponent(String(page))}`,
    (data) => mobileBalanceSheetSchema.parse(data),
    accessToken,
  )
}

export function fetchShopify(accessToken: string): Promise<MobileShopify> {
  return read("/api/mobile/v1/me/shopify", (data) => mobileShopifySchema.parse(data), accessToken)
}

export function actOnShopify(accessToken: string, body: MobileShopifyActionBody): Promise<MobileShopifyActionResult> {
  return read("/api/mobile/v1/me/shopify", (data) => mobileShopifyActionResultSchema.parse(data), accessToken, body)
}

export function fetchInbox(accessToken: string): Promise<MobileInbox> {
  return read("/api/mobile/v1/me/inbox", (data) => mobileInboxSchema.parse(data), accessToken)
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

/** Surfboard drop-off cities. Same list as the website sell flow. Availability follows board length and width. */
export function fetchSellDropoffLocations(boardLength: string, boardWidth: string): Promise<MobileSellDropoffLocations> {
  const params = new URLSearchParams()
  if (boardLength.trim()) params.set("board_length", boardLength.trim())
  if (boardWidth.trim()) params.set("board_width", boardWidth.trim())
  const query = params.toString()
  return read(`/api/mobile/v1/sell/dropoff-locations${query ? `?${query}` : ""}`, (data) =>
    mobileSellDropoffLocationsSchema.parse(data),
  )
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

const DRAFT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sellListingBody(draft: SellDraft, images: MobileSellPhoto[], includeDraftId: boolean) {
  const price = Number(draft.price)
  const shippingPrice = Number(draft.shippingPrice)
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    brand: draft.brand.trim(),
    model: draft.model.trim(),
    category: draft.category,
    subcategory: draft.subcategory.trim(),
    condition: draft.condition,
    price: Number.isFinite(price) ? price : null,
    city: draft.city.trim(),
    state: draft.state.trim(),
    location_lat: draft.locationLat,
    location_lng: draft.locationLng,
    local_pickup: draft.localPickup,
    shipping: draft.shipping,
    shipping_mode: draft.shippingMode,
    shipping_price: draft.shippingPrice.trim() && Number.isFinite(shippingPrice) ? shippingPrice : null,
    package_length: draft.packageLength,
    package_width: draft.packageWidth,
    package_height: draft.packageHeight,
    package_weight_lb: draft.packageWeightLb,
    package_weight_oz: draft.packageWeightOz,
    dropoff_location_id: DRAFT_ID.test(draft.dropoffLocationId) ? draft.dropoffLocationId : null,
    specs: {
      length: draft.specs.length,
      width: draft.specs.width,
      thickness: draft.specs.thickness,
      volume: draft.specs.volume,
      fin_setup: draft.specs.fin_setup,
      fin_system: draft.specs.fin_system,
      fins_included: draft.specs.fins_included,
      construction: draft.specs.construction,
    },
    images,
    ...(includeDraftId ? { draft_id: DRAFT_ID.test(draft.serverDraftId) ? draft.serverDraftId : null } : { id: DRAFT_ID.test(draft.serverDraftId) ? draft.serverDraftId : null }),
  }
}

export async function uploadSellPhoto(accessToken: string, uri: string): Promise<MobileSellPhoto> {
  const form = new FormData()
  form.append("file", { uri, name: "photo.jpg", type: "image/jpeg" } as unknown as Blob)
  const response = await fetch(`${apiOrigin()}/api/mobile/v1/sell/photos`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    body: form,
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Couldn't upload that photo"
    throw new Error(message)
  }
  if (!body || typeof body !== "object" || !("data" in body)) throw new Error("Couldn't upload that photo")
  return mobileSellPhotoSchema.parse(body.data)
}

/** Uploads photos that are still only on the phone. Photos already stored are reused. */
export async function uploadSellPhotos(accessToken: string, photos: SellPhoto[]): Promise<SellPhoto[]> {
  const uploaded: SellPhoto[] = []
  for (const photo of photos) {
    if (photo.url && photo.thumbnailUrl) {
      uploaded.push(photo)
      continue
    }
    const stored = await uploadSellPhoto(accessToken, photo.uri)
    uploaded.push({ ...photo, url: stored.url, thumbnailUrl: stored.thumbnail_url })
  }
  return uploaded
}

export function saveSellListingDraft(accessToken: string, draft: SellDraft): Promise<MobileSellPublishResult> {
  const images = draft.photos.flatMap((photo) =>
    photo.url && photo.thumbnailUrl ? [{ url: photo.url, thumbnail_url: photo.thumbnailUrl }] : [],
  )
  return read(
    "/api/mobile/v1/sell/drafts",
    (data) => mobileSellPublishResultSchema.parse(data),
    accessToken,
    sellListingBody(draft, images, false),
  )
}

export function publishSellListing(accessToken: string, draft: SellDraft): Promise<MobileSellPublishResult> {
  const images = draft.photos.flatMap((photo) =>
    photo.url && photo.thumbnailUrl ? [{ url: photo.url, thumbnail_url: photo.thumbnailUrl }] : [],
  )
  return read(
    "/api/mobile/v1/sell/listings",
    (data) => mobileSellPublishResultSchema.parse(data),
    accessToken,
    sellListingBody(draft, images, true),
  )
}

export function fetchConversation(id: string, accessToken: string): Promise<MobileConversationDetail> {
  return read(
    `/api/mobile/v1/conversations/${encodeURIComponent(id)}`,
    (data) => mobileConversationDetailSchema.parse(data),
    accessToken,
  )
}
