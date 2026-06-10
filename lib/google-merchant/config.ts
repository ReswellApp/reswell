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

/** Google product taxonomy ID — verify in Merchant Center product data spec. */
export function getGoogleMerchantProductCategory(): string {
  return process.env.GOOGLE_MERCHANT_PRODUCT_CATEGORY?.trim() || "499811"
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
