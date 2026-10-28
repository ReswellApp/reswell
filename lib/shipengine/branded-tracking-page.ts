import { getShipEngineApiBase, getShipEngineBrandedTrackingThemeGuid } from "@/lib/shipengine/config"
import { shipEngineCarrierCodesToTry } from "@/lib/shipping/resolve-carrier-code"
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
  const nested = asRecord(root.data)
  const sources = [root, nested].filter((row): row is Record<string, unknown> => row != null)
  for (const source of sources) {
    const direct = normalizeBrandedTrackingUrl(typeof source.url === "string" ? source.url : null)
    if (direct) return direct
    const pages = source.tracking_pages ?? source.tracking_page
    const list = Array.isArray(pages) ? pages : pages != null ? [pages] : []
    for (const item of list) {
      const row = asRecord(item)
      const url = typeof row?.url === "string" ? row.url : null
      const normalized = normalizeBrandedTrackingUrl(url)
      if (normalized) return normalized
    }
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

function shipEngineErrorHint(data: unknown): string | null {
  const root = asRecord(data)
  if (!root) return null
  if (typeof root.message === "string" && root.message.trim()) {
    return root.message.trim().slice(0, 180)
  }
  const errors = root.errors
  if (!Array.isArray(errors)) return null
  const first = asRecord(errors[0])
  if (typeof first?.message === "string" && first.message.trim()) {
    return first.message.trim().slice(0, 180)
  }
  return null
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
  if (!themeGuid || !apiKey) {
    console.error("[branded-tracking] create skipped", {
      theme: Boolean(themeGuid),
      apiKey: Boolean(apiKey),
    })
    return null
  }
  if (!brandedTrackingCountrySupported(input.shipTo.countryCode)) return null
  if (!brandedTrackingCountrySupported(input.shipFrom.countryCode)) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TRACKING_PAGE_TIMEOUT_MS)
  try {
    const withService = buildBrandedTrackingPageBody(themeGuid, input)
    const withoutService = buildBrandedTrackingPageBody(themeGuid, {
      ...input,
      serviceCode: null,
    })
    const bodies = input.serviceCode?.trim() ? [withService, withoutService] : [withService]

    let lastStatus = 0
    let lastHint: string | null = null
    for (const body of bodies) {
      const res = await fetch(`${shipEngineOrigin()}/v-beta/tracking_page`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
      const data: unknown = await res.json().catch(() => null)
      const url = parseBrandedTrackingPageUrl(data)
      if (res.ok && url) return url
      lastStatus = res.status
      lastHint = shipEngineErrorHint(data)
      if (res.ok || res.status < 400 || res.status >= 500) break
    }

    console.error("[branded-tracking] create failed", {
      status: lastStatus,
      carrier: input.carrierCode,
      hint: lastHint,
    })
    return null
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

export type BrandedTrackingShipmentInput = {
  trackingNumber: string
  trackingCarrier?: string | null
  shipTo: BrandedTrackingLocality
  shipFrom: BrandedTrackingLocality
}

/** Tries the likely ShipEngine carrier codes until a branded page URL is returned. */
export async function createBrandedTrackingPageForShipment(
  input: BrandedTrackingShipmentInput,
): Promise<string | null> {
  const codes = shipEngineCarrierCodesToTry(input.trackingNumber, input.trackingCarrier)
  const serviceCode = serviceCodeFromTrackingCarrier(input.trackingCarrier)
  for (const carrierCode of codes) {
    const url = await createBrandedTrackingPage({
      trackingNumber: input.trackingNumber,
      carrierCode,
      serviceCode,
      shipTo: input.shipTo,
      shipFrom: input.shipFrom,
    })
    if (url) return url
  }
  return null
}
