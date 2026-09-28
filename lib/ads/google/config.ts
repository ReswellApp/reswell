import type { AdsPlatform } from "@/lib/types/adsManager"

import { AdsPlatformError } from "@/lib/ads/manager/errors"

const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords"
const DEFAULT_API_VERSION = "v21"

export function getGoogleAdsApiVersion(): string {
  const raw = process.env.GOOGLE_ADS_API_VERSION?.trim()
  return raw && /^v\d+$/.test(raw) ? raw : DEFAULT_API_VERSION
}

export function normalizeGoogleCustomerId(raw: string | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/-/g, "").trim()
  return /^\d{10}$/.test(digits) ? digits : null
}

export function getGoogleAdsCustomerId(): string | null {
  return normalizeGoogleCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID)
}

export function getGoogleAdsLoginCustomerId(): string | null {
  return normalizeGoogleCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)
}

export function getGoogleAdsDeveloperToken(): string | null {
  const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()
  return token || null
}

export function googleAdsMissingConfig(): string[] {
  const missing: string[] = []
  if (!getGoogleAdsDeveloperToken()) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN")
  if (!getGoogleAdsCustomerId()) missing.push("GOOGLE_ADS_CUSTOMER_ID")
  const hasOauth = Boolean(
    process.env.GOOGLE_ADS_CLIENT_ID?.trim() &&
      process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim(),
  )
  const hasServiceAccount = Boolean(process.env.GOOGLE_ADS_SERVICE_ACCOUNT_JSON?.trim())
  if (!hasOauth && !hasServiceAccount) {
    missing.push("GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, and GOOGLE_ADS_REFRESH_TOKEN")
  }
  return missing
}

export function assertGoogleAdsConfigured(): {
  customerId: string
  developerToken: string
  loginCustomerId: string | null
} {
  const missing = googleAdsMissingConfig()
  if (missing.length > 0) {
    throw new AdsPlatformError(`Google Ads is not connected. Missing ${missing.join(", ")}`, "google")
  }
  const customerId = getGoogleAdsCustomerId()
  const developerToken = getGoogleAdsDeveloperToken()
  if (!customerId || !developerToken) {
    throw new AdsPlatformError("Google Ads is not connected", "google")
  }
  return {
    customerId,
    developerToken,
    loginCustomerId: getGoogleAdsLoginCustomerId(),
  }
}

export function googleAdsScope(): string {
  return GOOGLE_ADS_SCOPE
}

export function googlePlatform(): AdsPlatform {
  return "google"
}
