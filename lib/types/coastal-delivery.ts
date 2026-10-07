export const COASTAL_WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

export type CoastalDirection = "northbound" | "southbound"

export type CoastalMatchReason =
  | "ok"
  | "same_stop"
  | "no_shippers"
  | "schedules_off"
  | "no_route_match"

export type CoastalStopView = {
  id: string
  slug: string
  name: string
  sortOrder: number
  latitude?: number | null
  longitude?: number | null
}

export const COASTAL_DELIVERY_STATUSES = ["waiting_for_run", "picked_up", "dropped_off", "cancelled"] as const

export type CoastalDeliveryStatus = (typeof COASTAL_DELIVERY_STATUSES)[number]

export type CoastalAddressSource = "order" | "listing"

/** Residential place copied onto a delivery request from an order or listing. */
export type CoastalAddressSnapshot = {
  label: string
  line1: string | null
  line2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  latitude: number | null
  longitude: number | null
  source: CoastalAddressSource
  geocodeAttempted: boolean
}

export type CoastalPlaceKind = "house" | "stop"

export type CoastalRunView = {
  id: string
  dayOfWeek: number
  direction: CoastalDirection
  enabled: boolean
  stopIds: string[]
  /** Null is the repeating weekly trip. A date is that week only. */
  serviceDate?: string | null
}

export type CoastalShipperExclusion = {
  id: string
  kind: "area" | "address"
  label: string
}

export type CoastalShipperProfileView = {
  id: string
  displayName: string
  email: string | null
  isShop: boolean
  phone: string
  notes: string
  scheduleEnabled: boolean
  runs: CoastalRunView[]
}

export type CoastalShipperSummary = {
  id: string
  displayName: string
  email: string | null
  isShop: boolean
  scheduleEnabled: boolean
  runCount: number
  enabledRunCount: number
  isYou: boolean
}

export type CoastalListingHit = {
  id: string
  title: string
  city: string | null
  state: string | null
  status: string
}

export type CoastalDeliveryChoiceView = {
  listingId: string
  pickupStopId: string
  sellerOriginLabel: string
  dropoffStopId: string
  shipperId: string | null
  matchedRunId: string | null
  status: CoastalDeliveryStatus
}

export type CoastalMatch = {
  shipperId: string
  displayName: string
  runId: string
  dayOfWeek: number
  direction: CoastalDirection
  nextRunOn: string
}

export type CoastalMatchResult = {
  reason: CoastalMatchReason
  matches: CoastalMatch[]
}

export type CoastalListingPreview = {
  id: string
  title: string
  city: string | null
  state: string | null
  status: string
  suggestedPickupStopId: string | null
}

export type CoastalDashboardJob = {
  id: string
  listingId: string
  listingTitle: string
  saleLabel: string
  buyerName: string | null
  sellerName: string
  sellerOriginLabel: string
  status: CoastalDeliveryStatus
  matchedRunId: string | null
  pickupStopId: string
  dropoffStopId: string
  pickupLabel: string
  dropoffLabel: string
  pickupStopName: string
  dropoffStopName: string
  pickupKind: CoastalPlaceKind
  dropoffKind: CoastalPlaceKind
  pickupLatitude: number | null
  pickupLongitude: number | null
  dropoffLatitude: number | null
  dropoffLongitude: number | null
  nextHandoff: string
  statusActionsEnabled: boolean
}

export type CoastalRunSheetSection = {
  key: string
  title: string
  subtitle: string
  runId: string | null
  enabled: boolean
  jobs: CoastalDashboardJob[]
}

export type CoastalCoverageStop = {
  id: string
  name: string
  sortOrder: number
  latitude: number
  longitude: number
}

export type CoastalShipperDashboardData = {
  shipperId: string
  displayName: string
  scheduleEnabled: boolean
  previewing: boolean
  weekLabel: string
  weekStart: string
  coverage: CoastalCoverageStop[]
  sections: CoastalRunSheetSection[]
  jobCount: number
  hasRuns: boolean
  stops: CoastalStopView[]
  trips: CoastalRunView[]
  regionStopIds: string[]
  regionsExplicit: boolean
  exclusions: CoastalShipperExclusion[]
}
