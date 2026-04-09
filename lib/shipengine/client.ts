import { getShipEngineApiBase } from "./config"

/**
 * Low-level ShipEngine HTTP client. Use from server-only code (Route Handlers, Server Actions).
 * Auth: `API-Key` header per https://www.shipengine.com/docs/auth/
 */
export async function shipEngineRequest(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const key = process.env.SHIPENGINE_API_KEY?.trim()
  if (!key) {
    throw new Error("SHIPENGINE_API_KEY is not set")
  }
  const base = getShipEngineApiBase().replace(/\/$/, "")
  const suffix = path.startsWith("/") ? path : `/${path}`
  const url = `${base}${suffix}`
  return fetch(url, {
    ...init,
    headers: {
      "API-Key": key,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
}
