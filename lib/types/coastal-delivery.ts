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
}

export type CoastalRunView = {
  id: string
  dayOfWeek: number
  direction: CoastalDirection
  enabled: boolean
  stopIds: string[]
}

export type CoastalShipperProfileView = {
  id: string
  displayName: string
  phone: string
  notes: string
  scheduleEnabled: boolean
  runs: CoastalRunView[]
}

export type CoastalShipperSummary = {
  id: string
  displayName: string
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
  status: "waiting_for_run"
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
