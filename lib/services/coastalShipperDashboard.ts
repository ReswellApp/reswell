import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import {
  getCoastalShipperSchedule,
  listCoastalJobListings,
  listCoastalProfileNames,
  listCoastalSaleOrdersForListings,
  listCoastalShipperJobs,
  listCoastalStops,
  setCoastalShipperRunEnabled,
  setCoastalShipperScheduleEnabled,
  updateCoastalDeliverySnapshots,
  updateCoastalDeliveryStatus,
  type CoastalJobListingRecord,
  type CoastalSaleOrderRecord,
  type CoastalShipperJobRecord,
  type CoastalShipperScheduleRecord,
} from "@/lib/db/coastal-delivery"
import { forwardGeocodePlaceForServer } from "@/lib/maps/forward-geocode-server"
import {
  addressSnapshotsEqual,
  canSetCoastalStatus,
  chooseCoastalSale,
  mergeAddressSnapshot,
  shippingContactName,
  snapshotFromListingPin,
  snapshotFromOrderShipping,
  type CoastalSaleChoice,
  type CoastalSaleOrder,
} from "@/lib/services/coastalAddressSnapshot"
import { authorizeCoastalShipperView, coastalJobVisibleToShipper } from "@/lib/services/coastalShipperAccess"
import { buildCoastalRunSheet, type CoastalJobDraft } from "@/lib/services/coastalShipperRunSheet"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type {
  CoastalAddressSnapshot,
  CoastalDeliveryStatus,
  CoastalShipperDashboardData,
} from "@/lib/types/coastal-delivery"
import type { SupabaseClient } from "@supabase/supabase-js"

const UNAVAILABLE = "That coastal run is not available."
const GEOCODE_CAP = 8

type Ok<T> = { ok: true; data: T }
type NotFound = { ok: false; code: "not_found" }
type Failed = { ok: false; code: "error"; error: string }
type Mutation = { ok: true } | { ok: false; error: string }

export async function getCoastalShipperDashboard(input: {
  shipperId: string | null
}): Promise<Ok<CoastalShipperDashboardData> | NotFound | Failed> {
  try {
    const gate = await openShipperGate(input.shipperId)
    if (!gate.ok) return gate
    const data = await loadDashboard(gate.db, gate.schedule, gate.previewing)
    return { ok: true, data }
  } catch (error) {
    return loggedFailure(error, "Could not load the coastal run.")
  }
}

export async function setCoastalShipperDashboardSchedule(input: {
  shipperId: string
  enabled: boolean
}): Promise<Mutation> {
  try {
    const gate = await openShipperGate(input.shipperId)
    if (!gate.ok) return { ok: false, error: UNAVAILABLE }
    await setCoastalShipperScheduleEnabled(gate.db, gate.schedule.id, input.enabled)
    return { ok: true }
  } catch (error) {
    const failed = loggedFailure(error, "Could not update the schedule.")
    return { ok: false, error: failed.error }
  }
}

export async function setCoastalShipperDashboardRun(input: {
  shipperId: string
  runId: string
  enabled: boolean
}): Promise<Mutation> {
  try {
    const gate = await openShipperGate(input.shipperId)
    if (!gate.ok) return { ok: false, error: UNAVAILABLE }
    const saved = await setCoastalShipperRunEnabled(gate.db, gate.schedule.id, input.runId, input.enabled)
    if (!saved) return { ok: false, error: "That run is not on this schedule." }
    return { ok: true }
  } catch (error) {
    const failed = loggedFailure(error, "Could not update that run.")
    return { ok: false, error: failed.error }
  }
}

export async function setCoastalShipperDashboardJobStatus(input: {
  shipperId: string
  requestId: string
  status: CoastalDeliveryStatus
}): Promise<Mutation> {
  try {
    const gate = await openShipperGate(input.shipperId)
    if (!gate.ok) return { ok: false, error: UNAVAILABLE }
    const runIds = gate.schedule.runs.map((run) => run.id)
    const jobs = await listCoastalShipperJobs(gate.db, gate.schedule.id, runIds)
    const job = jobs.find((row) => row.id === input.requestId)
    if (!job || !coastalJobVisibleToShipper({
      shipperId: gate.schedule.id,
      requestShipperId: job.shipperId,
      matchedRunId: job.matchedRunId,
      runIds,
    })) {
      return { ok: false, error: "That board is not on your runs." }
    }
    if (!canSetCoastalStatus(job.status, input.status)) {
      return { ok: false, error: "That status change does not match this handoff." }
    }
    const listing = (await listCoastalJobListings(gate.db, [job.listingId]))[0]
    const sales = await listCoastalSaleOrdersForListings(gate.db, [job.listingId])
    const choice = chooseCoastalSale(sales.filter((order) => order.listingIds.includes(job.listingId)).map(toSaleOrder))
    if (choice.kind === "refunded") {
      return { ok: false, error: "This sale was refunded, so the handoff stays put." }
    }
    if (!listing) return { ok: false, error: "That board is not on your runs." }
    await updateCoastalDeliveryStatus(gate.db, job.id, input.status)
    return { ok: true }
  } catch (error) {
    const failed = loggedFailure(error, "Could not update that handoff.")
    return { ok: false, error: failed.error }
  }
}

async function openShipperGate(shipperId: string | null): Promise<
  | { ok: true; db: SupabaseClient; schedule: CoastalShipperScheduleRecord; previewing: boolean }
  | NotFound
> {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) return { ok: false, code: "not_found" }
  const isAdmin = await fetchProfileIsAdmin(session, user.id)
  const db = createServiceRoleClient()
  const schedule = shipperId
    ? await getCoastalShipperSchedule(db, { shipperId })
    : await getCoastalShipperSchedule(db, { userId: user.id })
  const allowed = authorizeCoastalShipperView({
    userId: user.id,
    isAdmin,
    shipperUserId: schedule?.userId ?? null,
  })
  if (allowed !== "allow" || !schedule) return { ok: false, code: "not_found" }
  return {
    ok: true,
    db,
    schedule,
    previewing: isAdmin && schedule.userId !== user.id,
  }
}

async function loadDashboard(
  db: SupabaseClient,
  schedule: CoastalShipperScheduleRecord,
  previewing: boolean,
): Promise<CoastalShipperDashboardData> {
  const runIds = schedule.runs.map((run) => run.id)
  const [stops, jobs] = await Promise.all([
    listCoastalStops(db),
    listCoastalShipperJobs(db, schedule.id, runIds),
  ])
  const visible = jobs.filter((job) =>
    coastalJobVisibleToShipper({
      shipperId: schedule.id,
      requestShipperId: job.shipperId,
      matchedRunId: job.matchedRunId,
      runIds,
    }),
  )
  const listingIds = [...new Set(visible.map((job) => job.listingId))]
  const [listings, saleRows] = await Promise.all([
    listCoastalJobListings(db, listingIds),
    listCoastalSaleOrdersForListings(db, listingIds),
  ])
  const listingsById = new Map(listings.map((listing) => [listing.id, listing]))
  const names = await listCoastalProfileNames(db, profileIds(listings, saleRows))
  const drafts = visible.map((job) => toDraft(job, listingsById.get(job.listingId), saleRows, names))
  await placeDropoffs(drafts)
  await persistSnapshots(db, visible, drafts)
  const sheet = buildCoastalRunSheet({ now: new Date(), runs: schedule.runs, stops, jobs: drafts })
  return {
    shipperId: schedule.id,
    displayName: schedule.displayName,
    scheduleEnabled: schedule.scheduleEnabled,
    previewing,
    weekLabel: sheet.weekLabel,
    coverage: sheet.coverage,
    sections: sheet.sections,
    jobCount: sheet.jobs.length,
    hasRuns: schedule.runs.length > 0,
  }
}

function toDraft(
  job: CoastalShipperJobRecord,
  listing: CoastalJobListingRecord | undefined,
  saleRows: CoastalSaleOrderRecord[],
  names: Map<string, string>,
): CoastalJobDraft {
  const choice = chooseCoastalSale(
    saleRows.filter((order) => order.listingIds.includes(job.listingId)).map(toSaleOrder),
  )
  const pickup = mergeAddressSnapshot(
    job.pickupAddress,
    listing
      ? snapshotFromListingPin({
          city: listing.city,
          state: listing.state,
          latitude: listing.latitude,
          longitude: listing.longitude,
        })
      : null,
  )
  const dropoffSource = choice.kind === "placed" ? snapshotFromOrderShipping(choice.order.shippingAddress) : null
  const dropoff = mergeAddressSnapshot(job.dropoffAddress, dropoffSource)
  const sellerId = choice.kind === "placed" ? choice.order.sellerId : listing?.userId ?? null
  return {
    id: job.id,
    listingId: job.listingId,
    listingTitle: listing?.title ?? "Untitled listing",
    saleLabel: saleLabel(choice),
    buyerName: choice.kind === "placed" ? personName(choice.order.buyerId, names, shippingContactName(choice.order.shippingAddress)) : null,
    sellerName: personName(sellerId, names, null) ?? "Seller",
    sellerOriginLabel: job.sellerOriginLabel,
    status: job.status,
    matchedRunId: job.matchedRunId,
    pickupStopId: job.pickupStopId,
    dropoffStopId: job.dropoffStopId,
    pickupSnapshot: pickup,
    dropoffSnapshot: dropoff,
    salePlaced: choice.kind === "placed",
    statusActionsEnabled: choice.kind !== "refunded",
  }
}

async function placeDropoffs(drafts: CoastalJobDraft[]): Promise<void> {
  let placed = 0
  for (const draft of drafts) {
    const dropoff = draft.dropoffSnapshot
    if (!dropoff || dropoff.source !== "order" || dropoff.latitude != null || dropoff.geocodeAttempted) continue
    if (placed >= GEOCODE_CAP) break
    draft.dropoffSnapshot = await geocodeDropoff(dropoff)
    placed += 1
  }
}

async function persistSnapshots(
  db: SupabaseClient,
  jobs: CoastalShipperJobRecord[],
  drafts: CoastalJobDraft[],
): Promise<void> {
  const stored = new Map(jobs.map((job) => [job.id, job]))
  for (const draft of drafts) {
    const job = stored.get(draft.id)
    if (!job) continue
    if (
      addressSnapshotsEqual(job.pickupAddress, draft.pickupSnapshot) &&
      addressSnapshotsEqual(job.dropoffAddress, draft.dropoffSnapshot)
    ) {
      continue
    }
    await updateCoastalDeliverySnapshots(db, draft.id, draft.pickupSnapshot, draft.dropoffSnapshot)
  }
}

async function geocodeDropoff(snapshot: CoastalAddressSnapshot): Promise<CoastalAddressSnapshot> {
  const query = [snapshot.line1, snapshot.city, snapshot.state, snapshot.postalCode, "USA"].filter(Boolean).join(", ")
  try {
    const coords = await forwardGeocodePlaceForServer(query)
    return {
      ...snapshot,
      latitude: coords && Number.isFinite(coords.lat) ? coords.lat : null,
      longitude: coords && Number.isFinite(coords.lng) ? coords.lng : null,
      geocodeAttempted: true,
    }
  } catch (error) {
    console.error("[coastal-delivery]", {
      message: error instanceof Error ? error.message : "Could not place the drop-off.",
      at: new Date().toISOString(),
    })
    return { ...snapshot, geocodeAttempted: true }
  }
}

function toSaleOrder(row: CoastalSaleOrderRecord): CoastalSaleOrder {
  return {
    id: row.id,
    orderNum: row.orderNum,
    listingIds: row.listingIds,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    status: row.status,
    isAdminTest: row.isAdminTest,
    shippingAddress: row.shippingAddress,
    createdAt: row.createdAt,
  }
}

function saleLabel(choice: CoastalSaleChoice): string {
  if (choice.kind === "placed") return choice.order.orderNum ? `Order ${choice.order.orderNum}` : "Sale placed"
  if (choice.kind === "refunded") return "Sale was refunded"
  return "Sale is not placed"
}

function personName(id: string | null, names: Map<string, string>, fallback: string | null): string | null {
  if (id) {
    const stored = names.get(id)?.trim()
    if (stored) return stored
  }
  const extra = fallback?.trim() ?? ""
  return extra.length > 0 ? extra : null
}

function profileIds(listings: CoastalJobListingRecord[], orders: CoastalSaleOrderRecord[]): string[] {
  const ids: string[] = []
  for (const listing of listings) if (listing.userId) ids.push(listing.userId)
  for (const order of orders) {
    if (order.buyerId) ids.push(order.buyerId)
    if (order.sellerId) ids.push(order.sellerId)
  }
  return ids
}

function loggedFailure(error: unknown, fallback: string): Failed {
  const message = error instanceof Error ? error.message : fallback
  console.error("[coastal-delivery]", { message, at: new Date().toISOString() })
  return { ok: false, code: "error", error: fallback }
}
