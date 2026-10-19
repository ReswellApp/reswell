import { type CoastalMatchShipper } from "@/lib/services/coastalDeliveryMatch"
import { soonestEnabledTrip } from "@/lib/services/coastalShipperWeek"
import { COASTAL_WEEKDAY_LABELS } from "@/lib/types/coastal-delivery"
import { deliveryDatesForPickup, tripWindowFromRun, weekdaySpanLabel } from "@/lib/utils/shipperTripWindow"
import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"
import { isShipperPriceCents, shipperPriceUsd } from "@/lib/utils/shipperPrice"

export const SURFBOARD_SHIPPED_NAME = "Surfboard Shipped"
export const SURFBOARD_SHIPPED_FEE_USD = 100
export const SURFBOARD_SHIPPED_FEE_CENTS = 10_000
export const SURFBOARD_SHIPPED_WINDOW_MIN_DAYS = 7
export const SURFBOARD_SHIPPED_WINDOW_MAX_DAYS = 14
export const SURFBOARD_SHIPPED_WINDOW_LABEL = "7–14 days" as const

const PACIFIC_TIME_ZONE = "America/Los_Angeles"

export type LiveSurfboardShipper = {
  id: string
  displayName: string
  priceUsd: number
  live: true
  /** Pickup copy shown on /sell/boards while this shipper is live. */
  pickupNotes: string[]
  /** Delivery windows buyers can be matched to, such as Thursday–Saturday. */
  deliveryLabels: string[]
}

export type SurfboardShippedWindow = {
  startDate: string
  endDate: string
  label: string
  description: string | null
}

export type SurfboardShippedAttachment = {
  shipperId: string
  displayName: string
  runId: string
  dayOfWeek: number
  weekdayLabel: string
  nextRunOn: string
  feeUsd: number
  /** Live shippers whose enabled runs cover this corridor, soonest first. */
  availableShippers: LiveSurfboardShipper[]
  deliveryWindow: SurfboardShippedWindow
}

export function isCaliforniaAddressState(state: string | null | undefined): boolean {
  const code = normalizeUsStateProvinceForShipping("US", (state ?? "").trim())
  return code.toUpperCase() === "CA"
}

export function coastalShipperIsLive(shipper: {
  scheduleEnabled: boolean
  runs: { enabled: boolean }[]
}): boolean {
  return shipper.scheduleEnabled === true && shipper.runs.some((run) => run.enabled)
}

function uniqueCopy(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const copy: string[] = []
  for (const value of values) {
    const text = value?.trim() ?? ""
    if (!text || seen.has(text)) continue
    seen.add(text)
    copy.push(text)
  }
  return copy
}

export function liveSurfboardShippers(shippers: CoastalMatchShipper[]): LiveSurfboardShipper[] {
  return shippers
    .filter(coastalShipperIsLive)
    .map((shipper) => {
      const enabled = shipper.runs.filter((run) => run.enabled)
      return {
        id: shipper.shipperId,
        displayName: shipper.displayName,
        priceUsd: shipperPriceUsd(shipper.priceCents),
        live: true as const,
        pickupNotes: uniqueCopy(enabled.map((run) => run.pickupDescription)),
        deliveryLabels: uniqueCopy(
          enabled.map((run) => {
            const window = tripWindowFromRun(run)
            return weekdaySpanLabel(window.deliveryStart, window.deliveryEnd)
          }),
        ),
      }
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function surfboardShippedSellDropoffCopy(labels: readonly string[]): string {
  const unique = uniqueCopy(labels)
  if (unique.length === 0) return `Drop-off is ${SURFBOARD_SHIPPED_WINDOW_LABEL}.`
  if (unique.length === 1) return `Drop-off is ${unique[0]}.`
  return `Drop-off is ${unique.join(" or ")}.`
}

export function surfboardShippedDropoffCopy(
  window: { label?: string | null; description?: string | null } | null | undefined,
): string {
  const label = window?.label?.trim() || SURFBOARD_SHIPPED_WINDOW_LABEL
  const timing = label === SURFBOARD_SHIPPED_WINDOW_LABEL ? `Drop-off in ${label}` : `Drop-off ${label}`
  const description = window?.description?.trim()
  return description ? `${timing}. ${description}` : `${timing}.`
}

/** Seller option on /sell/boards. Buyer address is not known yet. */
export function surfboardShippedSellVisible(input: {
  isAdmin: boolean
  pickupState: string | null | undefined
  shippers: CoastalMatchShipper[]
}): boolean {
  return (
    input.isAdmin &&
    isCaliforniaAddressState(input.pickupState) &&
    liveSurfboardShippers(input.shippers).length > 0
  )
}

/**
 * Google resolved a street in California. City centroids and other states do not count.
 * Los Angeles, Oakland, and same-city trips qualify when this is true for both ends.
 */
export function isGoogleCaliforniaStreet(
  address: {
    country?: string | null
    state?: string | null
    line1?: string | null
  } | null
  | undefined,
): boolean {
  if (!address) return false
  const country = (address.country ?? "").trim().toUpperCase()
  if (country !== "US" && country !== "USA" && country !== "UNITED STATES") return false
  if (!isCaliforniaAddressState(address.state)) return false
  return /^\d/.test((address.line1 ?? "").trim())
}

/** Checkout option. Hidden unless Google placed both streets in California and a shipper is live. */
export function surfboardShippedCheckoutVisible(input: {
  isAdmin: boolean
  sellerOptedIn: boolean
  pickupInCalifornia: boolean
  buyerInCalifornia: boolean
  shippers: CoastalMatchShipper[]
}): boolean {
  return (
    input.isAdmin &&
    input.sellerOptedIn &&
    input.pickupInCalifornia &&
    input.buyerInCalifornia &&
    liveSurfboardShippers(input.shippers).length > 0
  )
}

/** Drop-off window the buyer selects. Calendar days in America/Los_Angeles. */
export function surfboardShippedWindow(now: Date): SurfboardShippedWindow {
  return {
    startDate: addPacificDays(now, SURFBOARD_SHIPPED_WINDOW_MIN_DAYS),
    endDate: addPacificDays(now, SURFBOARD_SHIPPED_WINDOW_MAX_DAYS),
    label: SURFBOARD_SHIPPED_WINDOW_LABEL,
    description: null,
  }
}

/**
 * Attach the soonest live run. Any California street qualifies, including the
 * same city. Corridor stop names are not used.
 */
export function attachSurfboardShippedShipper(input: {
  shippers: CoastalMatchShipper[]
  now: Date
}): SurfboardShippedAttachment | null {
  const ranked = input.shippers
    .filter(coastalShipperIsLive)
    .map((shipper) => {
      const soonest = soonestEnabledTrip(input.now, shipper.runs)
      if (!soonest) return null
      return {
        shipper,
        run: soonest.run,
        nextRunOn: soonest.date,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort(
      (a, b) =>
        a.nextRunOn.localeCompare(b.nextRunOn) ||
        a.shipper.displayName.localeCompare(b.shipper.displayName),
    )

  const soonest = ranked[0]
  if (!soonest) return null
  const delivery = deliveryDatesForPickup(soonest.nextRunOn, soonest.run)

  return {
    shipperId: soonest.shipper.shipperId,
    displayName: soonest.shipper.displayName,
    runId: soonest.run.id,
    dayOfWeek: soonest.run.dayOfWeek,
    weekdayLabel: COASTAL_WEEKDAY_LABELS[soonest.run.dayOfWeek] ?? "Run",
    nextRunOn: soonest.nextRunOn,
    feeUsd: shipperPriceUsd(soonest.shipper.priceCents),
    availableShippers: ranked.map((row) => {
      const shipper = liveSurfboardShippers([row.shipper])[0]
      return (
        shipper ?? {
          id: row.shipper.shipperId,
          displayName: row.shipper.displayName,
          priceUsd: shipperPriceUsd(row.shipper.priceCents),
          live: true as const,
          pickupNotes: [],
          deliveryLabels: [],
        }
      )
    }),
    deliveryWindow: {
      startDate: delivery.startDate,
      endDate: delivery.endDate,
      label: delivery.label,
      description: soonest.run.deliveryDescription?.trim() || null,
    },
  }
}

export type SurfboardShippedOrderWrite = {
  surfboard_shipped: true
  surfboard_shipped_shipper_id: string
  surfboard_shipped_run_id: string
  surfboard_shipped_owed_cents: number
  surfboard_shipped_window_start: string
  surfboard_shipped_window_end: string
}

/** Reads the charge snapshot stored on the PaymentIntent. Null when this is not Surfboard Shipped. */
export function readSurfboardShippedPaymentMetadata(
  metadata: Record<string, string | undefined> | null | undefined,
): { ok: true; write: SurfboardShippedOrderWrite; feeUsd: number } | { ok: false; error: string } | null {
  if (!metadata || metadata.surfboard_shipped !== "1") return null

  const shipperId = metadata.surfboard_shipped_shipper_id?.trim() ?? ""
  const runId = metadata.surfboard_shipped_run_id?.trim() ?? ""
  const windowStart = metadata.surfboard_shipped_window_start?.trim() ?? ""
  const windowEnd = metadata.surfboard_shipped_window_end?.trim() ?? ""
  const cents = metadata.surfboard_shipped_cents?.trim() ?? ""

  const owedCents = Number(cents)
  if (
    !isUuid(shipperId) ||
    !isUuid(runId) ||
    !isIsoDate(windowStart) ||
    !isIsoDate(windowEnd) ||
    !isShipperPriceCents(owedCents)
  ) {
    return { ok: false, error: "Surfboard Shipped payment is missing shipper details." }
  }

  return {
    ok: true,
    feeUsd: owedCents / 100,
    write: {
      surfboard_shipped: true,
      surfboard_shipped_shipper_id: shipperId,
      surfboard_shipped_run_id: runId,
      surfboard_shipped_owed_cents: owedCents,
      surfboard_shipped_window_start: windowStart,
      surfboard_shipped_window_end: windowEnd,
    },
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function addPacificDays(now: Date, days: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "")
  const utc = new Date(Date.UTC(read("year"), read("month") - 1, read("day") + days))
  const year = utc.getUTCFullYear()
  const month = String(utc.getUTCMonth() + 1).padStart(2, "0")
  const day = String(utc.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
