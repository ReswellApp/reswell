/**
 * Shippo REST API — rates, labels, carrier accounts.
 * https://docs.goshippo.com/docs/guides/getting-started/
 */
export function getShippoApiBase(): string {
  return process.env.SHIPPO_API_BASE?.trim() || "https://api.goshippo.com"
}

export function isShippoConfigured(): boolean {
  const key = process.env.SHIPPO_API_KEY?.trim()
  return Boolean(key && key.length > 0)
}
