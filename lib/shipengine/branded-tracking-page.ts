import { getShipEngineApiBase, getShipEngineBrandedTrackingThemeGuid } from "@/lib/shipengine/config"
import { normalizeBrandedTrackingUrl } from "@/lib/utils/branded-tracking-url"

const TRACKING_PAGE_TIMEOUT_MS = 12_000

/** ShipEngine branded portal is limited to these destinations. */
const BRANDED_TRACKING_COUNTRIES = new Set(["US", "CA", "GB", "AU"])

export type BrandedTrackingLocality = {
  cityLocality: string
  stateProvince: string
  postalCode: string
  countryCode: string
}

export type BrandedTrackingPageInput = {
  trackingNumber: string
  carrierCode: string
  serviceCode?: string | null
  shipTo: BrandedTrackingLocality
  shipFrom: BrandedTrackingLocality
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function brandedTrackingCountrySupported(countryCode: string | null | undefined): boolean {
  const code = (countryCode ?? "").trim().toUpperCase()
  if (code === "UK") return true
  return BRANDED_TRACKING_COUNTRIES.has(code)
}

/** Second segment of stored labels like `usps · usps_priority_mail`. */
export function serviceCodeFromTrackingCarrier(carrier: string | null | undefined): string | null {
  const parts = (carrier ?? "")
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean)
  const candidate = parts.length >= 2 ? parts[1] : null
  if (!candidate || !/^[a-z0-9_]+$/i.test(candidate)) return null
  return candidate.toLowerCase()
}

export function parseBrandedTrackingPageUrl(data: unknown): string | null {
  const root = asRecord(data)
  if (!root) return null
  const pages = root.tracking_pages ?? root.tracking_page
  const list = Array.isArray(pages) ? pages : pages != null ? [pages] : []
  for (const item of list) {
    const row = asRecord(item)
    const url = typeof row?.url === "string" ? row.url : null
    const normalized = normalizeBrandedTrackingUrl(url)
    if (normalized) return normalized
  }
  return null
}

export function buildBrandedTrackingPageBody(
  themeGuid: string,
  input: BrandedTrackingPageInput,
): Record<string, unknown> {
  const page: Record<string, unknown> = {
    branded_tracking_theme_guid: themeGuid,
    tracking_number: input.trackingNumber.trim(),
    carrier_code: input.carrierCode.trim().toLowerCase(),
    to_city_locality: input.shipTo.cityLocality.trim(),
    to_state_province: input.shipTo.stateProvince.trim(),
    to_postal_code: input.shipTo.postalCode.trim(),
    to_country_code: input.shipTo.countryCode.trim().toUpperCase() === "UK" ? "GB" : input.shipTo.countryCode.trim().toUpperCase(),
    from_city_locality: input.shipFrom.cityLocality.trim(),
    from_state_province: input.shipFrom.stateProvince.trim(),
    from_postal_code: input.shipFrom.postalCode.trim(),
    from_country_code:
      input.shipFrom.countryCode.trim().toUpperCase() === "UK"
        ? "GB"
        : input.shipFrom.countryCode.trim().toUpperCase(),
  }
  const service = input.serviceCode?.trim()
  if (service) page.service_code = service
  return { tracking_pages: [page] }
}

function shipEngineOrigin(): string {
  try {
    return new URL(getShipEngineApiBase()).origin
  } catch {
    return "https://api.shipengine.com"
  }
}

/**
 * POST https://api.shipengine.com/v-beta/tracking_page.
 * This route is not under the /v1 base used for labels.
 * Returns null when the theme is unset or ShipEngine rejects the shipment.
 */
export async function createBrandedTrackingPage(
  input: BrandedTrackingPageInput,
): Promise<string | null> {
  const themeGuid = getShipEngineBrandedTrackingThemeGuid()
  const apiKey = process.env.SHIPENGINE_API_KEY?.trim()
  if (!themeGuid || !apiKey) return null
  if (!brandedTrackingCountrySupported(input.shipTo.countryCode)) return null
  if (!brandedTrackingCountrySupported(input.shipFrom.countryCode)) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TRACKING_PAGE_TIMEOUT_MS)
  try {
    const res = await fetch(`${shipEngineOrigin()}/v-beta/tracking_page`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildBrandedTrackingPageBody(themeGuid, input)),
    })
    const data: unknown = await res.json().catch(() => null)
    const url = parseBrandedTrackingPageUrl(data)
    if (!res.ok || !url) {
      console.error("[branded-tracking] create failed", {
        status: res.status,
        carrier: input.carrierCode,
      })
      return null
    }
    return url
  } catch (error) {
    console.error("[branded-tracking] create failed", {
      carrier: input.carrierCode,
      message: error instanceof Error ? error.message : "request failed",
    })
    return null
  } finally {
    clearTimeout(timer)
  }
}
