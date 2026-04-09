/**
 * ShipEngine REST API — labels, rates, carriers.
 * https://www.shipengine.com/docs/auth/
 */
export function getShipEngineApiBase(): string {
  return (
    process.env.SHIPENGINE_API_BASE?.trim() || "https://api.shipengine.com/v1"
  )
}

export function isShipEngineConfigured(): boolean {
  const key = process.env.SHIPENGINE_API_KEY?.trim()
  return Boolean(key && key.length > 0)
}
