import "server-only"

import { GoogleAuth } from "google-auth-library"

import { AdsPlatformError } from "@/lib/ads/manager/errors"
import { googleAdsScope } from "@/lib/ads/google/config"

let cached: { token: string; expiresAt: number } | null = null

export async function getGoogleAdsAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token

  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim()
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim()
  if (refreshToken && clientId && clientSecret) {
    const token = await refreshAccessToken(clientId, clientSecret, refreshToken)
    cached = token
    return token.token
  }

  const credentials = parseServiceAccount()
  const auth = new GoogleAuth({
    credentials: credentials ?? undefined,
    scopes: [googleAdsScope()],
  })
  const client = await auth.getClient()
  const result = await client.getAccessToken()
  if (!result.token) {
    throw new AdsPlatformError("Google Ads did not return an access token", "google")
  }
  cached = { token: result.token, expiresAt: Date.now() + 45 * 60_000 }
  return result.token
}

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ token: string; expiresAt: number }> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  })
  const payload = (await response.json().catch(() => null)) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  } | null
  if (!response.ok || !payload?.access_token) {
    const detail = payload?.error_description || payload?.error || `HTTP ${response.status}`
    throw new AdsPlatformError(`Google Ads rejected the refresh token (${detail})`, "google")
  }
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600
  return { token: payload.access_token, expiresAt: Date.now() + expiresIn * 1000 }
}

function parseServiceAccount(): Record<string, unknown> | null {
  const raw = process.env.GOOGLE_ADS_SERVICE_ACCOUNT_JSON?.trim()
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object")
    }
    return parsed as Record<string, unknown>
  } catch {
    throw new AdsPlatformError("GOOGLE_ADS_SERVICE_ACCOUNT_JSON is not valid JSON", "google")
  }
}
