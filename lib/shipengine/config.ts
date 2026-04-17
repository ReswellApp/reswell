/**
 * ShipEngine REST API — labels, rates, carriers.
 * https://www.shipengine.com/docs/auth/
 */
export function getShipEngineApiBase(): string {
  return (
    process.env.SHIPENGINE_API_BASE?.trim() || "https://api.shipengine.com/v1"
  )
}

/** JWKS for verifying outbound webhooks (RSA-SHA256). */
export function getShipEngineJwksUrl(): string {
  const base = process.env.SHIPENGINE_API_BASE?.trim().toLowerCase() || ""
  if (base.includes("api.eu.shipengine.com")) {
    return "https://api.eu.shipengine.com/jwks"
  }
  return "https://api.shipengine.com/jwks"
}

export function isShipEngineConfigured(): boolean {
  const key = process.env.SHIPENGINE_API_KEY?.trim()
  return Boolean(key && key.length > 0)
}
