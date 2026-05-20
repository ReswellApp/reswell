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
