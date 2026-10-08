import Constants from "expo-constants"
import {
  mobileListingDetailSchema,
  mobileListingsPageSchema,
  mobileMeSchema,
  type MobileListingDetail,
  type MobileListingsPage,
  type MobileMe,
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
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:3000"
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

async function getJson(path: string, accessToken?: string | null): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const response = await fetch(`${apiOrigin()}${path}`, { headers })
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

export function fetchListings(offset = 0): Promise<MobileListingsPage> {
  return getJson(`/api/mobile/v1/listings?limit=20&offset=${offset}`).then((data) =>
    mobileListingsPageSchema.parse(data),
  )
}

export function fetchListing(id: string): Promise<MobileListingDetail> {
  return getJson(`/api/mobile/v1/listings/${encodeURIComponent(id)}`).then((data) =>
    mobileListingDetailSchema.parse(data),
  )
}

export function fetchMe(accessToken: string): Promise<MobileMe> {
  return getJson("/api/mobile/v1/me", accessToken).then((data) => mobileMeSchema.parse(data))
}
