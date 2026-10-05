import { parseOrderShippingAddressForProfile } from "@/lib/profile-address"
import type { CoastalAddressSnapshot, CoastalDeliveryStatus } from "@/lib/types/coastal-delivery"

const LIVE_SALE_STATUSES = new Set(["pending", "confirmed", "refunding"])

export type CoastalSaleOrder = {
  id: string
  orderNum: string | null
  listingIds: string[]
  buyerId: string | null
  sellerId: string | null
  status: string
  isAdminTest: boolean
  shippingAddress: unknown
  createdAt: string
}

export type CoastalSaleChoice =
  | { kind: "placed"; order: CoastalSaleOrder }
  | { kind: "refunded" }
  | { kind: "none" }

export function chooseCoastalSale(orders: CoastalSaleOrder[]): CoastalSaleChoice {
  const real = orders.filter((order) => !order.isAdminTest)
  const live = real
    .filter((order) => LIVE_SALE_STATUSES.has(order.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  const placed = live[0]
  if (placed) return { kind: "placed", order: placed }
  if (real.some((order) => order.status === "refunded")) return { kind: "refunded" }
  return { kind: "none" }
}

export function canSetCoastalStatus(from: CoastalDeliveryStatus, to: CoastalDeliveryStatus): boolean {
  if (from === to) return false
  if (from === "waiting_for_run") return to === "picked_up"
  if (from === "picked_up") return to === "dropped_off" || to === "waiting_for_run"
  return to === "picked_up"
}

export function snapshotFromListingPin(input: {
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
}): CoastalAddressSnapshot | null {
  const latitude = finiteCoord(input.latitude)
  const longitude = finiteCoord(input.longitude)
  if (latitude == null || longitude == null) return null
  if (latitude === 0 && longitude === 0) return null
  const city = blankToNull(input.city)
  const state = blankToNull(input.state)
  const place = [city, state].filter((part): part is string => Boolean(part)).join(", ")
  return {
    label: place || "Listing location",
    line1: null,
    line2: null,
    city,
    state,
    postalCode: null,
    latitude,
    longitude,
    source: "listing",
    geocodeAttempted: true,
  }
}

export function snapshotFromOrderShipping(ship: unknown): CoastalAddressSnapshot | null {
  const parsed = parseOrderShippingAddressForProfile(ship)
  if (!parsed) return null
  const cityState = [parsed.city, parsed.state].filter(Boolean).join(", ")
  const label = [parsed.line1, parsed.line2, cityState, parsed.postal_code].filter(Boolean).join(", ")
  return {
    label,
    line1: parsed.line1,
    line2: parsed.line2,
    city: parsed.city,
    state: parsed.state,
    postalCode: parsed.postal_code,
    latitude: null,
    longitude: null,
    source: "order",
    geocodeAttempted: false,
  }
}

export function shippingContactName(ship: unknown): string | null {
  if (ship == null || typeof ship !== "object" || Array.isArray(ship)) return null
  const name = (ship as Record<string, unknown>).name
  return typeof name === "string" && name.trim().length > 0 ? name.trim() : null
}

/** Keep stored coordinates when the street has not changed. */
export function mergeAddressSnapshot(
  existing: CoastalAddressSnapshot | null,
  next: CoastalAddressSnapshot | null,
): CoastalAddressSnapshot | null {
  if (!next) return null
  if (!existing || !sameStreet(existing, next)) return next
  if (existing.latitude != null && existing.longitude != null) {
    return {
      ...next,
      latitude: existing.latitude,
      longitude: existing.longitude,
      geocodeAttempted: true,
    }
  }
  if (existing.geocodeAttempted) {
    return { ...next, geocodeAttempted: true }
  }
  return next
}

export function addressSnapshotsEqual(
  a: CoastalAddressSnapshot | null,
  b: CoastalAddressSnapshot | null,
): boolean {
  if (a == null || b == null) return a == null && b == null
  return (
    a.label === b.label &&
    a.line1 === b.line1 &&
    a.line2 === b.line2 &&
    a.city === b.city &&
    a.state === b.state &&
    a.postalCode === b.postalCode &&
    a.latitude === b.latitude &&
    a.longitude === b.longitude &&
    a.source === b.source &&
    a.geocodeAttempted === b.geocodeAttempted
  )
}

function sameStreet(a: CoastalAddressSnapshot, b: CoastalAddressSnapshot): boolean {
  return (
    normalize(a.line1) === normalize(b.line1) &&
    normalize(a.city) === normalize(b.city) &&
    normalize(a.postalCode) === normalize(b.postalCode) &&
    a.source === b.source
  )
}

function normalize(value: string | null): string {
  return (value ?? "").trim().toLowerCase()
}

function blankToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : null
}

function finiteCoord(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return value
}
