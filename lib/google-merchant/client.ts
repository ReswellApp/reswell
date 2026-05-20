import { getGoogleMerchantAccessToken } from "./auth"
import { GOOGLE_MERCHANT_API_BASE } from "./config"

export type GoogleMerchantRequestResult = {
  ok: boolean
  status: number
  data: unknown
}

/**
 * Authenticated fetch wrapper for Merchant API REST endpoints.
 */
export async function googleMerchantRequest(
  path: string,
  init?: RequestInit,
): Promise<GoogleMerchantRequestResult> {
  const token = await getGoogleMerchantAccessToken()
  const suffix = path.startsWith("/") ? path : `/${path}`
  const url = `${GOOGLE_MERCHANT_API_BASE}${suffix}`

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = { raw: text }
    }
  }

  return { ok: res.ok, status: res.status, data }
}
