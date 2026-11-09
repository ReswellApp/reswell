const BRANDED_TRACKING_HOST = "track.shipengine.com"

/** Accept only the hosted ShipEngine tracker. Stored values are rendered as links. */
export function normalizeBrandedTrackingUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? ""
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  if (url.hostname !== BRANDED_TRACKING_HOST) return null
  url.protocol = "https:"
  url.hash = ""
  return url.toString()
}
