/** OAuth scope for Merchant API (Content API for Shopping successor). */
export const GOOGLE_MERCHANT_OAUTH_SCOPE = "https://www.googleapis.com/auth/content"

export const GOOGLE_MERCHANT_API_BASE = "https://merchantapi.googleapis.com"

export type GoogleMerchantAuthMode =
  | "workload_identity_federation"
  | "service_account_json"
  | "application_default"
  | "none"

export function isGoogleMerchantWorkloadIdentityConfigured(): boolean {
  return Boolean(
    process.env.GCP_PROJECT_NUMBER?.trim() &&
      process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim() &&
      process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim(),
  )
}

export function getGoogleMerchantAuthMode(): GoogleMerchantAuthMode {
  if (isGoogleMerchantWorkloadIdentityConfigured()) {
    return "workload_identity_federation"
  }
  if (process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON?.trim()) {
    return "service_account_json"
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    return "application_default"
  }
  return "none"
}

export function isGoogleMerchantConfigured(): boolean {
  return Boolean(
    getGoogleMerchantAccountId() &&
      getGoogleMerchantDataSourceName() &&
      getGoogleMerchantAuthMode() !== "none",
  )
}

export function getGoogleMerchantAccountId(): string | null {
  const raw = process.env.GOOGLE_MERCHANT_ACCOUNT_ID?.trim()
  return raw || null
}

/** Full resource name, e.g. accounts/123/dataSources/456 */
export function getGoogleMerchantDataSourceName(): string | null {
  const raw = process.env.GOOGLE_MERCHANT_DATA_SOURCE_NAME?.trim()
  return raw || null
}

export function getGoogleMerchantFeedLabel(): string {
  return process.env.GOOGLE_MERCHANT_FEED_LABEL?.trim() || "US"
}

export function getGoogleMerchantContentLanguage(): string {
  return process.env.GOOGLE_MERCHANT_CONTENT_LANGUAGE?.trim() || "en"
}

/** Peer listing sections synced to the Merchant Center primary feed. */
export const GOOGLE_MERCHANT_PEER_SECTIONS = ["surfboards", "fins", "wetsuits", "magazines"] as const

export type GoogleMerchantPeerSection = (typeof GOOGLE_MERCHANT_PEER_SECTIONS)[number]

export function isGoogleMerchantPeerSection(section: string): section is GoogleMerchantPeerSection {
  return (GOOGLE_MERCHANT_PEER_SECTIONS as readonly string[]).includes(section)
}

/** Google product taxonomy ID — verify in Merchant Center product data spec. */
export function getGoogleMerchantProductCategory(): string {
  return process.env.GOOGLE_MERCHANT_PRODUCT_CATEGORY?.trim() || "499811"
}

/** Google taxonomy: Sporting Goods > … > Surfing > Surfboard Fins (3525). */
export const GOOGLE_MERCHANT_DEFAULT_FINS_PRODUCT_CATEGORY = "3525"

/** Google taxonomy: Media > Magazines & Newspapers > Magazines (784). */
export const GOOGLE_MERCHANT_DEFAULT_MAGAZINES_PRODUCT_CATEGORY = "784"

/** Google taxonomy: Sporting Goods > … > Boating & Water Sport Apparel (499813). */
export const GOOGLE_MERCHANT_DEFAULT_WETSUITS_PRODUCT_CATEGORY = "499813"

export function getGoogleMerchantFinsProductCategory(): string {
  return (
    process.env.GOOGLE_MERCHANT_FINS_PRODUCT_CATEGORY?.trim() ||
    GOOGLE_MERCHANT_DEFAULT_FINS_PRODUCT_CATEGORY
  )
}

export function getGoogleMerchantMagazinesProductCategory(): string {
  return (
    process.env.GOOGLE_MERCHANT_MAGAZINES_PRODUCT_CATEGORY?.trim() ||
    GOOGLE_MERCHANT_DEFAULT_MAGAZINES_PRODUCT_CATEGORY
  )
}

export function getGoogleMerchantWetsuitsProductCategory(): string {
  return (
    process.env.GOOGLE_MERCHANT_WETSUITS_PRODUCT_CATEGORY?.trim() ||
    GOOGLE_MERCHANT_DEFAULT_WETSUITS_PRODUCT_CATEGORY
  )
}

export function getGoogleMerchantProductCategoryForSection(section: string): string {
  if (section === "fins") return getGoogleMerchantFinsProductCategory()
  if (section === "magazines") return getGoogleMerchantMagazinesProductCategory()
  if (section === "wetsuits") return getGoogleMerchantWetsuitsProductCategory()
  return getGoogleMerchantProductCategory()
}

/** Default customLabel0 values for Reswell sections (Shopping / PMax campaign filters). */
export const GOOGLE_MERCHANT_DEFAULT_SURFBOARDS_CUSTOM_LABEL = "Surfboards"
export const GOOGLE_MERCHANT_DEFAULT_WETSUITS_CUSTOM_LABEL = "Wetsuits"
export const GOOGLE_MERCHANT_DEFAULT_MAGAZINES_CUSTOM_LABEL = "Magazines"
export const GOOGLE_MERCHANT_DEFAULT_FINS_CUSTOM_LABEL = "Fins"

/** Default customLabel1 for OutSurfing shop listings (Shopping / PMax seller filter). */
export const GOOGLE_MERCHANT_DEFAULT_OUTSURFING_SHOP_CUSTOM_LABEL = "OutSurfing"

/** Profile email for OutSurfing’s seller shop (fallback when USER_ID env unset). */
export const GOOGLE_MERCHANT_OUTSURFING_SHOP_SELLER_EMAIL = "davidacason@gmail.com"

/**
 * Merchant Center `customLabel0` for a listing section.
 * Used to segment surfboards, wetsuits, magazines, and fins in Google Ads.
 */
export function getGoogleMerchantCustomLabel0ForSection(section: string): string | undefined {
  switch (section) {
    case "surfboards":
      return (
        process.env.GOOGLE_MERCHANT_SURFBOARDS_CUSTOM_LABEL?.trim() ||
        GOOGLE_MERCHANT_DEFAULT_SURFBOARDS_CUSTOM_LABEL
      )
    case "wetsuits":
      return (
        process.env.GOOGLE_MERCHANT_WETSUITS_CUSTOM_LABEL?.trim() ||
        GOOGLE_MERCHANT_DEFAULT_WETSUITS_CUSTOM_LABEL
      )
    case "magazines":
      return (
        process.env.GOOGLE_MERCHANT_MAGAZINES_CUSTOM_LABEL?.trim() ||
        GOOGLE_MERCHANT_DEFAULT_MAGAZINES_CUSTOM_LABEL
      )
    case "fins":
      return (
        process.env.GOOGLE_MERCHANT_FINS_CUSTOM_LABEL?.trim() ||
        GOOGLE_MERCHANT_DEFAULT_FINS_CUSTOM_LABEL
      )
    default:
      return undefined
  }
}

/**
 * Merchant Center `customLabel1` for OutSurfing shop listings.
 * Override with `GOOGLE_MERCHANT_OUTSURFING_SHOP_CUSTOM_LABEL`.
 * Use in Google Ads: listing group / asset group filter Custom label 1 = OutSurfing.
 */
export function getGoogleMerchantOutSurfingShopCustomLabel(): string {
  return (
    process.env.GOOGLE_MERCHANT_OUTSURFING_SHOP_CUSTOM_LABEL?.trim() ||
    GOOGLE_MERCHANT_DEFAULT_OUTSURFING_SHOP_CUSTOM_LABEL
  )
}

export function getGoogleMerchantDeveloperEmail(): string | null {
  const raw = process.env.GOOGLE_MERCHANT_DEVELOPER_EMAIL?.trim()
  return raw || null
}

/**
 * National median placeholder for Reswell-calculated surfboard shipping in the Merchant feed.
 * Checkout still uses live ShipEngine quotes; this is only for Google Shopping row metadata.
 */
export const GOOGLE_MERCHANT_DEFAULT_ESTIMATED_SHIPPING_USD = 89

/** Representative USD shipping for Reswell-calculated fin rates in the Merchant feed. */
export const GOOGLE_MERCHANT_DEFAULT_FINS_ESTIMATED_SHIPPING_USD = 15

/** Representative USD shipping for Reswell-calculated magazine rates in the Merchant feed. */
export const GOOGLE_MERCHANT_DEFAULT_MAGAZINES_ESTIMATED_SHIPPING_USD = 10

/** Representative USD shipping for Reswell-calculated wetsuit rates in the Merchant feed. */
export const GOOGLE_MERCHANT_DEFAULT_WETSUITS_ESTIMATED_SHIPPING_USD = 20

/** Representative USD shipping for Reswell-calculated surfboard rates in the Merchant feed. */
export function getGoogleMerchantEstimatedShippingUsd(): number {
  const raw = process.env.GOOGLE_MERCHANT_ESTIMATED_SHIPPING_USD?.trim()
  if (raw) {
    const parsed = Number.parseFloat(raw)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed * 100) / 100
    }
  }
  return GOOGLE_MERCHANT_DEFAULT_ESTIMATED_SHIPPING_USD
}

/** Representative USD shipping for Reswell-calculated fin rates in the Merchant feed. */
export function getGoogleMerchantFinsEstimatedShippingUsd(): number {
  const raw = process.env.GOOGLE_MERCHANT_FINS_ESTIMATED_SHIPPING_USD?.trim()
  if (raw) {
    const parsed = Number.parseFloat(raw)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed * 100) / 100
    }
  }
  return GOOGLE_MERCHANT_DEFAULT_FINS_ESTIMATED_SHIPPING_USD
}

export function getGoogleMerchantMagazinesEstimatedShippingUsd(): number {
  const raw = process.env.GOOGLE_MERCHANT_MAGAZINES_ESTIMATED_SHIPPING_USD?.trim()
  if (raw) {
    const parsed = Number.parseFloat(raw)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed * 100) / 100
    }
  }
  return GOOGLE_MERCHANT_DEFAULT_MAGAZINES_ESTIMATED_SHIPPING_USD
}

export function getGoogleMerchantWetsuitsEstimatedShippingUsd(): number {
  const raw = process.env.GOOGLE_MERCHANT_WETSUITS_ESTIMATED_SHIPPING_USD?.trim()
  if (raw) {
    const parsed = Number.parseFloat(raw)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed * 100) / 100
    }
  }
  return GOOGLE_MERCHANT_DEFAULT_WETSUITS_ESTIMATED_SHIPPING_USD
}

export function getGoogleMerchantEstimatedShippingUsdForSection(section: string): number {
  if (section === "fins") return getGoogleMerchantFinsEstimatedShippingUsd()
  if (section === "magazines") return getGoogleMerchantMagazinesEstimatedShippingUsd()
  if (section === "wetsuits") return getGoogleMerchantWetsuitsEstimatedShippingUsd()
  return getGoogleMerchantEstimatedShippingUsd()
}

/** Optional US tax rate (percentage) for feed rows, e.g. `0` or `8.25`. Omit when unset. */
export function getGoogleMerchantUsTaxRate(): number | null {
  const raw = process.env.GOOGLE_MERCHANT_US_TAX_RATE?.trim()
  if (!raw) return null
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

export const GOOGLE_MERCHANT_MAX_ADDITIONAL_IMAGES = 10

export function getGoogleMerchantWorkloadIdentityAudience(): string | null {
  const projectNumber = process.env.GCP_PROJECT_NUMBER?.trim()
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim()
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim()
  if (!projectNumber || !poolId || !providerId) return null
  return `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`
}

export function getGoogleMerchantParentAccount(): string {
  const accountId = getGoogleMerchantAccountId()
  if (!accountId) {
    throw new Error("GOOGLE_MERCHANT_ACCOUNT_ID is not set")
  }
  return `accounts/${accountId}`
}

/** Fields read from Merchant API `Product` resources when scoping to this integration. */
export type GoogleMerchantFeedProductIdentity = {
  offerId?: string | null
  contentLanguage?: string | null
  feedLabel?: string | null
  dataSource?: string | null
}

/**
 * True when a processed Merchant Center product belongs to this Reswell API primary feed.
 * Excludes legacy Content API feeds and other data sources in the same account.
 */
export function matchesGoogleMerchantFeedProduct(
  product: GoogleMerchantFeedProductIdentity,
): boolean {
  const offerId = product.offerId?.trim()
  if (!offerId) return false

  const contentLanguage = getGoogleMerchantContentLanguage()
  const feedLabel = getGoogleMerchantFeedLabel()
  const dataSourceName = getGoogleMerchantDataSourceName()

  const lang = product.contentLanguage?.trim()
  const label = product.feedLabel?.trim()
  const source = product.dataSource?.trim()

  if (lang && lang !== contentLanguage) return false
  if (label && label !== feedLabel) return false

  if (dataSourceName) {
    if (!source || source !== dataSourceName) return false
  }

  return true
}
