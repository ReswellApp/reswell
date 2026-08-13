import { createServiceRoleClient } from "@/lib/supabase/server"
import { listingDetailHref } from "@/lib/listing-href"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { capitalizeWords, formatCondition } from "@/lib/listing-labels"
import { US_STATE_NAME_TO_CODE } from "@/lib/us-state-name-to-code"
import { isAdminSeedListingTitle } from "@/lib/utils/admin-seed-listing"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { boardFulfillmentFromFlags } from "@/lib/listing-fulfillment"
import {
  listPickupOnlySurfboards,
  type PickupOnlySurfboardDbRow,
} from "@/lib/db/pickupOnlySurfboards"

const UNKNOWN_LOCALITY_KEY = "unknown"
/** Suggested paid-social / search radius around a pickup city. */
export const PICKUP_AD_RADIUS_MILES = 25

export type PickupOnlySurfboardListing = {
  id: string
  title: string
  href: string
  absoluteUrl: string
  thumbnailUrl: string | null
  price: number
  brand: string | null
  model: string | null
  conditionLabel: string | null
  boardType: string | null
  dimensions: string | null
  views: number
  createdAt: string
  daysListed: number
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
}

export type PickupOnlyLocality = {
  key: string
  label: string
  city: string | null
  state: string | null
  listingCount: number
  inventoryValue: number
  averagePrice: number
  averageDaysListed: number
  mappedCount: number
  latitude: number | null
  longitude: number | null
  listings: PickupOnlySurfboardListing[]
}

export type PickupOnlySurfboardsDashboard = {
  generatedAt: string
  listingCount: number
  localityCount: number
  mappedListingCount: number
  unmappedListingCount: number
  inventoryValue: number
  averagePrice: number
  adRadiusMiles: number
  localities: PickupOnlyLocality[]
  states: string[]
}

function parseCoord(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : Number.parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

function parsePrice(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? 0))
  return Number.isFinite(n) ? n : 0
}

function daysSince(iso: string, nowMs: number): number {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000))
}

export function normalizePickupStateCode(state: string | null | undefined): string {
  const s = (state ?? "").trim()
  if (!s) return ""
  if (/^[a-z]{2}$/i.test(s)) return s.toUpperCase()
  return US_STATE_NAME_TO_CODE[s.toLowerCase()] ?? s
}

export function pickupLocalityKey(city: string | null | undefined, state: string | null | undefined): string {
  const cityKey = (city ?? "").trim().toLowerCase()
  const stateKey = normalizePickupStateCode(state).toLowerCase()
  if (!cityKey && !stateKey) return UNKNOWN_LOCALITY_KEY
  return `${cityKey}|${stateKey}`
}

function pickupLocalityLabel(city: string | null, state: string | null): string {
  const cityLabel = city ? capitalizeWords(city) : ""
  const stateLabel = normalizePickupStateCode(state)
  if (cityLabel && stateLabel) return `${cityLabel}, ${stateLabel}`
  if (cityLabel) return cityLabel
  if (stateLabel) return stateLabel
  return "Unknown location"
}

function mapListing(row: PickupOnlySurfboardDbRow, nowMs: number, origin: string): PickupOnlySurfboardListing {
  const href = listingDetailHref({ id: row.id, slug: row.slug, section: "surfboards" })
  const city = row.city?.trim() || null
  const stateRaw = row.state?.trim() || null
  const thumbnail = listingTitleThumbnailSrc(row.listing_images)
  const conditionLabel = formatCondition(row.condition) || null

  return {
    id: row.id,
    title: capitalizeWords(row.title) || row.title,
    href,
    absoluteUrl: `${origin}${href}`,
    thumbnailUrl: thumbnail || null,
    price: parsePrice(row.price),
    brand: row.brand?.trim() || null,
    model: row.model?.trim() || null,
    conditionLabel,
    boardType: row.board_type?.trim() || null,
    dimensions: row.dimensions?.trim() || null,
    views: Math.max(0, Number(row.views) || 0),
    createdAt: row.created_at,
    daysListed: daysSince(row.created_at, nowMs),
    city: city ? capitalizeWords(city) : null,
    state: normalizePickupStateCode(stateRaw) || stateRaw,
    latitude: parseCoord(row.latitude),
    longitude: parseCoord(row.longitude),
  }
}

function centroid(listings: PickupOnlySurfboardListing[]): { latitude: number; longitude: number } | null {
  let latSum = 0
  let lngSum = 0
  let count = 0
  for (const listing of listings) {
    if (listing.latitude == null || listing.longitude == null) continue
    latSum += listing.latitude
    lngSum += listing.longitude
    count += 1
  }
  if (count === 0) return null
  return { latitude: latSum / count, longitude: lngSum / count }
}

export async function getPickupOnlySurfboardsDashboard(): Promise<PickupOnlySurfboardsDashboard> {
  const supabase = createServiceRoleClient()
  const rows = await listPickupOnlySurfboards(supabase)
  const nowMs = Date.now()
  const origin = publicSiteOrigin()

  const listings = rows
    .filter((row) => {
      if (isAdminSeedListingTitle(row.title)) return false
      return boardFulfillmentFromFlags(row.local_pickup, row.shipping_available) === "pickup_only"
    })
    .map((row) => mapListing(row, nowMs, origin))

  const byLocality = new Map<string, PickupOnlySurfboardListing[]>()
  for (const listing of listings) {
    const key = pickupLocalityKey(listing.city, listing.state)
    const bucket = byLocality.get(key)
    if (bucket) bucket.push(listing)
    else byLocality.set(key, [listing])
  }

  const localities: PickupOnlyLocality[] = []
  for (const [key, group] of byLocality) {
    const inventoryValue = group.reduce((sum, listing) => sum + listing.price, 0)
    const mappedCount = group.filter((listing) => listing.latitude != null && listing.longitude != null).length
    const center = centroid(group)
    const first = group[0]
    localities.push({
      key,
      label: pickupLocalityLabel(first?.city ?? null, first?.state ?? null),
      city: first?.city ?? null,
      state: first?.state ?? null,
      listingCount: group.length,
      inventoryValue,
      averagePrice: group.length > 0 ? inventoryValue / group.length : 0,
      averageDaysListed:
        group.length > 0
          ? group.reduce((sum, listing) => sum + listing.daysListed, 0) / group.length
          : 0,
      mappedCount,
      latitude: center?.latitude ?? null,
      longitude: center?.longitude ?? null,
      listings: group,
    })
  }

  localities.sort((a, b) => {
    if (b.listingCount !== a.listingCount) return b.listingCount - a.listingCount
    return a.label.localeCompare(b.label)
  })

  const stateSet = new Set<string>()
  for (const locality of localities) {
    if (locality.state) stateSet.add(locality.state)
  }
  const states = [...stateSet].sort((a, b) => a.localeCompare(b))

  const inventoryValue = listings.reduce((sum, listing) => sum + listing.price, 0)
  const mappedListingCount = listings.filter(
    (listing) => listing.latitude != null && listing.longitude != null,
  ).length

  return {
    generatedAt: new Date(nowMs).toISOString(),
    listingCount: listings.length,
    localityCount: localities.length,
    mappedListingCount,
    unmappedListingCount: listings.length - mappedListingCount,
    inventoryValue,
    averagePrice: listings.length > 0 ? inventoryValue / listings.length : 0,
    adRadiusMiles: PICKUP_AD_RADIUS_MILES,
    localities,
    states,
  }
}
