import { getShippoApiBase } from "./config"

const SHIPPO_API_VERSION = "2018-02-08"

/**
 * Low-level Shippo HTTP client. Server-only (Route Handlers, Server Actions).
 * Auth: `Authorization: ShippoToken <token>` per https://docs.goshippo.com/docs/guides/getting-started/
 */
export async function shippoRequest(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const key = process.env.SHIPPO_API_KEY?.trim()
  if (!key) {
    throw new Error("SHIPPO_API_KEY is not set")
  }
  const base = getShippoApiBase().replace(/\/$/, "")
  const suffix = path.startsWith("/") ? path : `/${path}`
  const url = `${base}${suffix}`
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `ShippoToken ${key}`,
      "Content-Type": "application/json",
      "SHIPPO-API-VERSION": SHIPPO_API_VERSION,
      ...init?.headers,
    },
  })
}
