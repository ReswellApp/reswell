import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  CoastalAddressSnapshot,
  CoastalAddressSource,
  CoastalDeliveryChoiceView,
  CoastalDeliveryStatus,
  CoastalDirection,
  CoastalListingHit,
  CoastalListingPreview,
  CoastalRunView,
  CoastalShipperExclusion,
  CoastalStopView,
} from "@/lib/types/coastal-delivery"

export type CoastalShipperScheduleRecord = {
  id: string
  userId: string
  displayName: string
  phone: string
  notes: string
  scheduleEnabled: boolean
  runs: CoastalRunView[]
}

const STOP_SELECT = "id, slug, name, sort_order, latitude, longitude, active"
const SHIPPER_SELECT = "id, user_id, display_name, phone, notes, schedule_enabled"
const RUN_SELECT = "id, shipper_id, day_of_week, direction, enabled, service_date"
const RUN_SELECT_WEEKLY = "id, shipper_id, day_of_week, direction, enabled"
const LISTING_SELECT = "id, title, city, state, status, section"

export async function listCoastalStops(supabase: SupabaseClient): Promise<CoastalStopView[]> {
  const { data, error } = await supabase
    .from("coastal_stops")
    .select(STOP_SELECT)
    .eq("active", true)
    .order("sort_order", { ascending: true })

  if (error) throw error
  return asRecords(data).map(mapStop)
}

export async function listCoastalShipperSchedules(
  supabase: SupabaseClient,
): Promise<CoastalShipperScheduleRecord[]> {
  const [shippers, runs, runStops] = await Promise.all([
    supabase.from("coastal_shippers").select(SHIPPER_SELECT).order("display_name", { ascending: true }),
    selectShipperRuns(supabase),
    supabase.from("coastal_shipper_run_stops").select("run_id, stop_id"),
  ])

  if (shippers.error) throw shippers.error
  if (runs.error) throw runs.error
  if (runStops.error) throw runStops.error

  return assembleSchedules(asRecords(shippers.data), asRecords(runs.data), asRecords(runStops.data))
}

export async function getCoastalShipperByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<CoastalShipperScheduleRecord | null> {
  const schedules = await listCoastalShipperSchedules(supabase)
  return schedules.find((schedule) => schedule.userId === userId) ?? null
}

export async function upsertCoastalShipperProfile(
  supabase: SupabaseClient,
  input: { userId: string; displayName: string; phone: string | null; notes: string | null },
): Promise<void> {
  const { error } = await supabase.from("coastal_shippers").upsert(
    {
      user_id: input.userId,
      display_name: input.displayName,
      phone: input.phone,
      notes: input.notes,
    },
    { onConflict: "user_id" },
  )
  if (error) throw error
}

export async function setCoastalShipperScheduleEnabled(
  supabase: SupabaseClient,
  shipperId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("coastal_shippers")
    .update({ schedule_enabled: enabled })
    .eq("id", shipperId)
  if (error) throw error
}

export async function upsertCoastalShipperRun(
  supabase: SupabaseClient,
  input: {
    shipperId: string
    runId?: string
    dayOfWeek: number
    direction: CoastalDirection
    enabled: boolean
    stopIds: string[]
    serviceDate?: string | null
  },
): Promise<void> {
  const runId = await resolveRunId(supabase, input)
  const { error: stopDeleteError } = await supabase.from("coastal_shipper_run_stops").delete().eq("run_id", runId)
  if (stopDeleteError) throw stopDeleteError

  const { error: stopInsertError } = await supabase.from("coastal_shipper_run_stops").insert(
    input.stopIds.map((stopId) => ({ run_id: runId, stop_id: stopId })),
  )
  if (stopInsertError) throw stopInsertError
}

export async function deleteCoastalShipperRun(
  supabase: SupabaseClient,
  shipperId: string,
  runId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("coastal_shipper_runs")
    .delete()
    .eq("id", runId)
    .eq("shipper_id", shipperId)
    .select("id")
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("Run not found.")
}

export async function listCoastalCoverageIndex(supabase: SupabaseClient): Promise<{
  ready: boolean
  regions: Map<string, string[]>
  exclusions: Map<string, string[]>
}> {
  const [regions, exclusions] = await Promise.all([
    supabase.from("coastal_shipper_regions").select("shipper_id, stop_id"),
    supabase.from("coastal_shipper_exclusions").select("shipper_id, label"),
  ])
  const missing =
    Boolean(regions.error && isMissingShipperScheduleTable(regions.error.message)) ||
    Boolean(exclusions.error && isMissingShipperScheduleTable(exclusions.error.message))
  if (missing) return { ready: false, regions: new Map(), exclusions: new Map() }
  if (regions.error) throw regions.error
  if (exclusions.error) throw exclusions.error
  const regionMap = new Map<string, string[]>()
  for (const row of asRecords(regions.data)) {
    const shipperId = stringField(row, "shipper_id")
    const stopId = stringField(row, "stop_id")
    if (!shipperId || !stopId) continue
    const current = regionMap.get(shipperId) ?? []
    current.push(stopId)
    regionMap.set(shipperId, current)
  }
  const exclusionMap = new Map<string, string[]>()
  for (const row of asRecords(exclusions.data)) {
    const shipperId = stringField(row, "shipper_id")
    const label = stringField(row, "label")
    if (!shipperId || !label) continue
    const current = exclusionMap.get(shipperId) ?? []
    current.push(label)
    exclusionMap.set(shipperId, current)
  }
  return { ready: true, regions: regionMap, exclusions: exclusionMap }
}

export async function listCoastalShipperCoverage(
  supabase: SupabaseClient,
  shipperId: string,
): Promise<{ regionStopIds: string[]; regionsExplicit: boolean; exclusions: CoastalShipperExclusion[] }> {
  const [regions, exclusions] = await Promise.all([
    supabase.from("coastal_shipper_regions").select("stop_id").eq("shipper_id", shipperId),
    supabase.from("coastal_shipper_exclusions").select("id, kind, label").eq("shipper_id", shipperId),
  ])
  const regionsMissing = Boolean(regions.error && isMissingShipperScheduleTable(regions.error.message))
  const exclusionsMissing = Boolean(exclusions.error && isMissingShipperScheduleTable(exclusions.error.message))
  if (regions.error && !regionsMissing) throw regions.error
  if (exclusions.error && !exclusionsMissing) throw exclusions.error
  const regionStopIds = regionsMissing
    ? []
    : asRecords(regions.data).map((row) => stringField(row, "stop_id")).filter((id): id is string => Boolean(id))
  const exclusionRows: CoastalShipperExclusion[] = exclusionsMissing
    ? []
    : asRecords(exclusions.data).flatMap((row): CoastalShipperExclusion[] => {
        const id = stringField(row, "id")
        const label = stringField(row, "label")?.trim() ?? ""
        const kind = row.kind === "address" ? "address" : row.kind === "area" ? "area" : null
        if (!id || !kind || label.length < 2) return []
        return [{ id, kind, label }]
      })
  return { regionStopIds, regionsExplicit: !regionsMissing && regionStopIds.length > 0, exclusions: exclusionRows }
}

export async function replaceCoastalShipperRegions(
  supabase: SupabaseClient,
  shipperId: string,
  stopIds: string[],
): Promise<void> {
  const removed = await supabase.from("coastal_shipper_regions").delete().eq("shipper_id", shipperId)
  if (removed.error) throw scheduleTableError(removed.error)
  if (stopIds.length === 0) return
  const inserted = await supabase
    .from("coastal_shipper_regions")
    .insert(stopIds.map((stopId) => ({ shipper_id: shipperId, stop_id: stopId })))
  if (inserted.error) throw scheduleTableError(inserted.error)
}

export async function insertCoastalShipperExclusion(
  supabase: SupabaseClient,
  input: { shipperId: string; kind: "area" | "address"; label: string },
): Promise<void> {
  const { error } = await supabase.from("coastal_shipper_exclusions").insert({
    shipper_id: input.shipperId,
    kind: input.kind,
    label: input.label.trim(),
  })
  if (error) throw scheduleTableError(error)
}

export async function deleteCoastalShipperExclusion(
  supabase: SupabaseClient,
  shipperId: string,
  exclusionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("coastal_shipper_exclusions")
    .delete()
    .eq("id", exclusionId)
    .eq("shipper_id", shipperId)
  if (error) throw scheduleTableError(error)
}

function scheduleTableError(error: { message?: string }): Error {
  if (isMissingShipperScheduleTable(error.message)) {
    return new Error("Run the latest Shipper SQL, then try again.")
  }
  return new Error(error.message || "Could not save that.")
}

export async function searchCoastalPreviewListings(
  supabase: SupabaseClient,
  query: string,
): Promise<CoastalListingHit[]> {
  const trimmed = query.trim()
  let request = supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("section", "surfboards")
    .is("archived_at", null)
    .neq("status", "removed")
    .order("created_at", { ascending: false })
    .limit(12)

  if (isUuid(trimmed)) {
    request = request.eq("id", trimmed)
  } else if (trimmed) {
    request = request.ilike("title", `%${escapeIlike(trimmed)}%`)
  }

  const { data, error } = await request
  if (error) throw error
  return asRecords(data).map(mapListingHit)
}

export async function getCoastalPreviewListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<CoastalListingPreview | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", listingId)
    .eq("section", "surfboards")
    .is("archived_at", null)
    .neq("status", "removed")
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const hit = mapListingHit(asRecord(data))
  return { ...hit, suggestedPickupStopId: null }
}

export async function getCoastalDeliveryRequest(
  supabase: SupabaseClient,
  listingId: string,
): Promise<CoastalDeliveryChoiceView | null> {
  const { data, error } = await supabase
    .from("coastal_delivery_requests")
    .select("listing_id, pickup_stop_id, seller_origin_label, dropoff_stop_id, shipper_id, matched_run_id, status")
    .eq("listing_id", listingId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapDeliveryRequest(asRecord(data))
}

export async function upsertCoastalDeliveryRequest(
  supabase: SupabaseClient,
  input: {
    listingId: string
    pickupStopId: string
    sellerOriginLabel: string | null
    dropoffStopId: string
    shipperId: string | null
    matchedRunId: string | null
    createdBy: string
  },
): Promise<void> {
  const { error } = await supabase.from("coastal_delivery_requests").upsert(
    {
      listing_id: input.listingId,
      pickup_stop_id: input.pickupStopId,
      seller_origin_label: input.sellerOriginLabel,
      dropoff_stop_id: input.dropoffStopId,
      shipper_id: input.shipperId,
      matched_run_id: input.matchedRunId,
      created_by: input.createdBy,
    },
    { onConflict: "listing_id" },
  )
  if (error) throw error
}

export async function deleteCoastalDeliveryRequest(
  supabase: SupabaseClient,
  listingId: string,
): Promise<void> {
  const { error } = await supabase.from("coastal_delivery_requests").delete().eq("listing_id", listingId)
  if (error) throw error
}

const JOB_REQUEST_SELECT =
  "id, listing_id, pickup_stop_id, seller_origin_label, dropoff_stop_id, shipper_id, matched_run_id, status, pickup_address, dropoff_address"
const JOB_LISTING_SELECT = "id, title, city, state, status, user_id, latitude, longitude"
const SALE_ORDER_SELECT =
  "id, order_num, listing_id, buyer_id, seller_id, status, is_admin_test, shipping_address, created_at"

export type CoastalShipperJobRecord = {
  id: string
  listingId: string
  pickupStopId: string
  sellerOriginLabel: string
  dropoffStopId: string
  shipperId: string | null
  matchedRunId: string | null
  status: CoastalDeliveryStatus
  pickupAddress: CoastalAddressSnapshot | null
  dropoffAddress: CoastalAddressSnapshot | null
}

export type CoastalJobListingRecord = {
  id: string
  title: string
  city: string | null
  state: string | null
  status: string
  userId: string | null
  latitude: number | null
  longitude: number | null
}

export type CoastalSaleOrderRecord = {
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

/** One shipper row, that shipper's runs, and those runs' stops. Does not read other shippers. */
export async function getCoastalShipperSchedule(
  supabase: SupabaseClient,
  filter: { userId: string } | { shipperId: string },
): Promise<CoastalShipperScheduleRecord | null> {
  const request =
    "userId" in filter
      ? supabase.from("coastal_shippers").select(SHIPPER_SELECT).eq("user_id", filter.userId)
      : supabase.from("coastal_shippers").select(SHIPPER_SELECT).eq("id", filter.shipperId)
  const { data, error } = await request.maybeSingle()
  if (error) throw error
  if (!data) return null
  const shipper = asRecord(data)
  const shipperId = stringField(shipper, "id")
  if (!shipperId) return null

  const { data: runs, error: runsError } = await supabase
    .from("coastal_shipper_runs")
    .select(RUN_SELECT)
    .eq("shipper_id", shipperId)
  if (runsError) throw runsError
  const runRows = asRecords(runs)
  const runIds = runRows.flatMap((row) => {
    const id = stringField(row, "id")
    return id ? [id] : []
  })

  let stopRows: Record<string, unknown>[] = []
  if (runIds.length > 0) {
    const { data: runStops, error: runStopsError } = await supabase
      .from("coastal_shipper_run_stops")
      .select("run_id, stop_id")
      .in("run_id", runIds)
    if (runStopsError) throw runStopsError
    stopRows = asRecords(runStops)
  }

  return assembleSchedules([shipper], runRows, stopRows)[0] ?? null
}

/** Jobs assigned to this shipper or matched to one of their runs. */
export async function listCoastalShipperJobs(
  supabase: SupabaseClient,
  shipperId: string,
  runIds: string[],
): Promise<CoastalShipperJobRecord[]> {
  const [byShipper, byRun] = await Promise.all([
    supabase.from("coastal_delivery_requests").select(JOB_REQUEST_SELECT).eq("shipper_id", shipperId),
    runIds.length > 0
      ? supabase.from("coastal_delivery_requests").select(JOB_REQUEST_SELECT).in("matched_run_id", runIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (byShipper.error) throw byShipper.error
  if (byRun.error) throw byRun.error

  const byId = new Map<string, CoastalShipperJobRecord>()
  for (const row of [...asRecords(byShipper.data), ...asRecords(byRun.data)]) {
    const job = mapShipperJob(row)
    if (job) byId.set(job.id, job)
  }
  return [...byId.values()]
}

export async function listCoastalJobListings(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<CoastalJobListingRecord[]> {
  if (listingIds.length === 0) return []
  const { data, error } = await supabase.from("listings").select(JOB_LISTING_SELECT).in("id", listingIds)
  if (error) throw error
  return asRecords(data).flatMap((row) => {
    const id = stringField(row, "id")
    if (!id) return []
    return [
      {
        id,
        title: stringField(row, "title")?.trim() || "Untitled listing",
        city: stringField(row, "city"),
        state: stringField(row, "state"),
        status: stringField(row, "status") || "unknown",
        userId: stringField(row, "user_id"),
        latitude: finiteNumber(row.latitude),
        longitude: finiteNumber(row.longitude),
      },
    ]
  })
}

/**
 * Real checkout rows for these listings: the order's primary listing and any peer line item.
 * Admin test orders are included so the caller can ignore them.
 */
export async function listCoastalSaleOrdersForListings(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<CoastalSaleOrderRecord[]> {
  if (listingIds.length === 0) return []
  const [primary, items] = await Promise.all([
    supabase.from("orders").select(SALE_ORDER_SELECT).in("listing_id", listingIds),
    supabase.from("order_items").select("order_id, listing_id").in("listing_id", listingIds),
  ])
  if (primary.error) throw primary.error
  if (items.error) throw items.error

  const listingsByOrder = new Map<string, Set<string>>()
  const addLink = (orderId: string, listingId: string) => {
    if (!listingIds.includes(listingId)) return
    const current = listingsByOrder.get(orderId) ?? new Set<string>()
    current.add(listingId)
    listingsByOrder.set(orderId, current)
  }

  const primaryRows = asRecords(primary.data)
  for (const row of primaryRows) {
    const orderId = stringField(row, "id")
    const listingId = stringField(row, "listing_id")
    if (orderId && listingId) addLink(orderId, listingId)
  }

  const knownOrderIds = new Set(primaryRows.flatMap((row) => {
    const id = stringField(row, "id")
    return id ? [id] : []
  }))
  const extraOrderIds = [
    ...new Set(
      asRecords(items.data).flatMap((row) => {
        const orderId = stringField(row, "order_id")
        const listingId = stringField(row, "listing_id")
        if (orderId && listingId) addLink(orderId, listingId)
        return orderId && !knownOrderIds.has(orderId) ? [orderId] : []
      }),
    ),
  ]

  let extraRows: Record<string, unknown>[] = []
  if (extraOrderIds.length > 0) {
    const extra = await supabase.from("orders").select(SALE_ORDER_SELECT).in("id", extraOrderIds)
    if (extra.error) throw extra.error
    extraRows = asRecords(extra.data)
  }

  return [...primaryRows, ...extraRows].flatMap((row) => {
    const id = stringField(row, "id")
    if (!id) return []
    const listingId = stringField(row, "listing_id")
    const linked = listingsByOrder.get(id) ?? new Set<string>()
    if (listingId && listingIds.includes(listingId)) linked.add(listingId)
    if (linked.size === 0) return []
    return [
      {
        id,
        orderNum: stringField(row, "order_num"),
        listingIds: [...linked],
        buyerId: stringField(row, "buyer_id"),
        sellerId: stringField(row, "seller_id"),
        status: stringField(row, "status") ?? "",
        isAdminTest: row.is_admin_test === true,
        shippingAddress: row.shipping_address ?? null,
        createdAt: stringField(row, "created_at") ?? "",
      },
    ]
  })
}

export async function listCoastalProfileNames(
  supabase: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(profileIds.filter((id) => id.length > 0))]
  const names = new Map<string, string>()
  if (ids.length === 0) return names
  const { data, error } = await supabase.from("profiles").select("id, display_name, shop_name").in("id", ids)
  if (error) throw error
  for (const row of asRecords(data)) {
    const id = stringField(row, "id")
    if (!id) continue
    const displayName = stringField(row, "display_name")?.trim() ?? ""
    const shopName = stringField(row, "shop_name")?.trim() ?? ""
    const name = displayName || shopName
    if (name) names.set(id, name)
  }
  return names
}

export async function setCoastalShipperRunEnabled(
  supabase: SupabaseClient,
  shipperId: string,
  runId: string,
  enabled: boolean,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("coastal_shipper_runs")
    .update({ enabled })
    .eq("id", runId)
    .eq("shipper_id", shipperId)
    .select("id")
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function updateCoastalDeliveryStatus(
  supabase: SupabaseClient,
  requestId: string,
  status: CoastalDeliveryStatus,
): Promise<void> {
  const { error } = await supabase.from("coastal_delivery_requests").update({ status }).eq("id", requestId)
  if (error) throw error
}

export async function updateCoastalDeliverySnapshots(
  supabase: SupabaseClient,
  requestId: string,
  pickupAddress: CoastalAddressSnapshot | null,
  dropoffAddress: CoastalAddressSnapshot | null,
): Promise<void> {
  const { error } = await supabase
    .from("coastal_delivery_requests")
    .update({
      pickup_address: snapshotToJson(pickupAddress),
      dropoff_address: snapshotToJson(dropoffAddress),
    })
    .eq("id", requestId)
  if (error) throw error
}

async function resolveRunId(
  supabase: SupabaseClient,
  input: {
    shipperId: string
    runId?: string
    dayOfWeek: number
    direction: CoastalDirection
    enabled: boolean
    serviceDate?: string | null
  },
): Promise<string> {
  const serviceDate = input.serviceDate ?? null
  const patch = {
    day_of_week: input.dayOfWeek,
    direction: input.direction,
    enabled: input.enabled,
    service_date: serviceDate,
  }

  if (input.runId) {
    const id = await writeRunPatch(supabase, input.runId, input.shipperId, patch, serviceDate)
    if (!id) throw new Error("Run not found.")
    return id
  }

  let existingQuery = supabase
    .from("coastal_shipper_runs")
    .select("id")
    .eq("shipper_id", input.shipperId)
    .eq("direction", input.direction)
  existingQuery = serviceDate
    ? existingQuery.eq("service_date", serviceDate)
    : existingQuery.is("service_date", null).eq("day_of_week", input.dayOfWeek)
  let { data: existing, error: existingError } = await existingQuery.maybeSingle()
  if (existingError && isMissingServiceDateColumn(existingError.message)) {
    if (serviceDate) throw new Error("Run the latest Shipper SQL before saving a one-week trip.")
    const weeklyLookup = await supabase
      .from("coastal_shipper_runs")
      .select("id")
      .eq("shipper_id", input.shipperId)
      .eq("direction", input.direction)
      .eq("day_of_week", input.dayOfWeek)
      .maybeSingle()
    existing = weeklyLookup.data
    existingError = weeklyLookup.error
  }
  if (existingError) throw existingError

  const existingId = asRecord(existing).id
  if (typeof existingId === "string") {
    const id = await writeRunPatch(supabase, existingId, input.shipperId, patch, serviceDate)
    if (!id) throw new Error("Run not found.")
    return id
  }

  const { data, error } = await supabase
    .from("coastal_shipper_runs")
    .insert({ shipper_id: input.shipperId, ...patch })
    .select("id")
    .single()
  if (error && isMissingServiceDateColumn(error.message)) {
    if (serviceDate) throw new Error("Run the latest Shipper SQL before saving a one-week trip.")
    const weekly = await supabase
      .from("coastal_shipper_runs")
      .insert({
        shipper_id: input.shipperId,
        day_of_week: input.dayOfWeek,
        direction: input.direction,
        enabled: input.enabled,
      })
      .select("id")
      .single()
    if (weekly.error) throw friendlyRunError(weekly.error)
    const weeklyId = asRecord(weekly.data).id
    if (typeof weeklyId !== "string") throw new Error("Could not save that run.")
    return weeklyId
  }
  if (error) throw friendlyRunError(error)
  const id = asRecord(data).id
  if (typeof id !== "string") throw new Error("Could not save that run.")
  return id
}

function assembleSchedules(
  shipperRows: Record<string, unknown>[],
  runRows: Record<string, unknown>[],
  stopRows: Record<string, unknown>[],
): CoastalShipperScheduleRecord[] {
  const stopsByRun = new Map<string, string[]>()
  for (const row of stopRows) {
    const runId = stringField(row, "run_id")
    const stopId = stringField(row, "stop_id")
    if (!runId || !stopId) continue
    const current = stopsByRun.get(runId) ?? []
    current.push(stopId)
    stopsByRun.set(runId, current)
  }

  const runsByShipper = new Map<string, CoastalRunView[]>()
  for (const row of runRows) {
    const shipperId = stringField(row, "shipper_id")
    const run = mapRun(row, stopsByRun.get(stringField(row, "id") ?? "") ?? [])
    if (!shipperId || !run) continue
    const current = runsByShipper.get(shipperId) ?? []
    current.push(run)
    runsByShipper.set(shipperId, current)
  }

  return shipperRows.flatMap((row) => {
    const id = stringField(row, "id")
    const userId = stringField(row, "user_id")
    if (!id || !userId) return []
    const runs = runsByShipper.get(id) ?? []
    runs.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.direction.localeCompare(b.direction))
    return [
      {
        id,
        userId,
        displayName: stringField(row, "display_name") || "Shipper",
        phone: stringField(row, "phone") ?? "",
        notes: stringField(row, "notes") ?? "",
        scheduleEnabled: row.schedule_enabled === true,
        runs,
      },
    ]
  })
}

function mapStop(row: Record<string, unknown>): CoastalStopView {
  return {
    id: stringField(row, "id") ?? "",
    slug: stringField(row, "slug") ?? "",
    name: stringField(row, "name") ?? "",
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : Number(row.sort_order ?? 0),
    latitude: finiteNumber(row.latitude),
    longitude: finiteNumber(row.longitude),
  }
}

function mapRun(row: Record<string, unknown>, stopIds: string[]): CoastalRunView | null {
  const id = stringField(row, "id")
  const direction = row.direction === "northbound" || row.direction === "southbound" ? row.direction : null
  const dayOfWeek = typeof row.day_of_week === "number" ? row.day_of_week : Number(row.day_of_week)
  if (!id || !direction || !Number.isInteger(dayOfWeek)) return null
  const rawDate = stringField(row, "service_date")
  const serviceDate = rawDate && /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : null
  return { id, dayOfWeek, direction, enabled: row.enabled === true, stopIds, serviceDate }
}

async function selectShipperRuns(supabase: SupabaseClient) {
  const withDate = await supabase.from("coastal_shipper_runs").select(RUN_SELECT)
  if (!withDate.error || !isMissingServiceDateColumn(withDate.error.message)) return withDate
  return supabase.from("coastal_shipper_runs").select(RUN_SELECT_WEEKLY)
}

async function writeRunPatch(
  supabase: SupabaseClient,
  runId: string,
  shipperId: string,
  patch: { day_of_week: number; direction: CoastalDirection; enabled: boolean; service_date: string | null },
  serviceDate: string | null,
): Promise<string | null> {
  const updated = await supabase
    .from("coastal_shipper_runs")
    .update(patch)
    .eq("id", runId)
    .eq("shipper_id", shipperId)
    .select("id")
    .maybeSingle()
  if (updated.error && isMissingServiceDateColumn(updated.error.message)) {
    if (serviceDate) throw new Error("Run the latest Shipper SQL before saving a one-week trip.")
    const weekly = await supabase
      .from("coastal_shipper_runs")
      .update({ day_of_week: patch.day_of_week, direction: patch.direction, enabled: patch.enabled })
      .eq("id", runId)
      .eq("shipper_id", shipperId)
      .select("id")
      .maybeSingle()
    if (weekly.error) throw friendlyRunError(weekly.error)
    const id = asRecord(weekly.data).id
    return typeof id === "string" ? id : null
  }
  if (updated.error) throw friendlyRunError(updated.error)
  const id = asRecord(updated.data).id
  return typeof id === "string" ? id : null
}

function isMissingServiceDateColumn(message: string | undefined): boolean {
  return /column "service_date"|service_date/i.test(message ?? "") && /does not exist|schema cache/i.test(message ?? "")
}

export function isMissingShipperScheduleTable(message: string | undefined): boolean {
  return /coastal_shipper_(regions|exclusions)|service_date/i.test(message ?? "") && /does not exist|schema cache/i.test(message ?? "")
}

function mapListingHit(row: Record<string, unknown>): CoastalListingHit {
  return {
    id: stringField(row, "id") ?? "",
    title: stringField(row, "title")?.trim() || "Untitled listing",
    city: stringField(row, "city"),
    state: stringField(row, "state"),
    status: stringField(row, "status") || "unknown",
  }
}

function mapDeliveryRequest(row: Record<string, unknown>): CoastalDeliveryChoiceView | null {
  const listingId = stringField(row, "listing_id")
  const pickupStopId = stringField(row, "pickup_stop_id")
  const dropoffStopId = stringField(row, "dropoff_stop_id")
  if (!listingId || !pickupStopId || !dropoffStopId) return null
  return {
    listingId,
    pickupStopId,
    sellerOriginLabel: stringField(row, "seller_origin_label") ?? "",
    dropoffStopId,
    shipperId: stringField(row, "shipper_id"),
    matchedRunId: stringField(row, "matched_run_id"),
    status: parseDeliveryStatus(row.status),
  }
}

function friendlyRunError(error: { message: string; code?: string }): Error {
  if (error.code === "23505") {
    return new Error("You already have a run that day in that direction.")
  }
  return new Error(error.message || "Could not save that run.")
}

function mapShipperJob(row: Record<string, unknown>): CoastalShipperJobRecord | null {
  const id = stringField(row, "id")
  const listingId = stringField(row, "listing_id")
  const pickupStopId = stringField(row, "pickup_stop_id")
  const dropoffStopId = stringField(row, "dropoff_stop_id")
  if (!id || !listingId || !pickupStopId || !dropoffStopId) return null
  return {
    id,
    listingId,
    pickupStopId,
    sellerOriginLabel: stringField(row, "seller_origin_label") ?? "",
    dropoffStopId,
    shipperId: stringField(row, "shipper_id"),
    matchedRunId: stringField(row, "matched_run_id"),
    status: parseDeliveryStatus(row.status),
    pickupAddress: parseAddressSnapshot(row.pickup_address),
    dropoffAddress: parseAddressSnapshot(row.dropoff_address),
  }
}

function parseDeliveryStatus(value: unknown): CoastalDeliveryStatus {
  if (value === "picked_up" || value === "dropped_off" || value === "waiting_for_run" || value === "cancelled") {
    return value
  }
  return "waiting_for_run"
}

function parseAddressSnapshot(value: unknown): CoastalAddressSnapshot | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const source: CoastalAddressSource | null = row.source === "order" || row.source === "listing" ? row.source : null
  const label = stringField(row, "label")
  if (!source || !label) return null
  return {
    label,
    line1: stringField(row, "line1"),
    line2: stringField(row, "line2"),
    city: stringField(row, "city"),
    state: stringField(row, "state"),
    postalCode: stringField(row, "postal_code"),
    latitude: finiteNumber(row.latitude),
    longitude: finiteNumber(row.longitude),
    source,
    geocodeAttempted: row.geocode_attempted === true,
  }
}

function snapshotToJson(snapshot: CoastalAddressSnapshot | null): Record<string, unknown> | null {
  if (!snapshot) return null
  return {
    label: snapshot.label,
    line1: snapshot.line1,
    line2: snapshot.line2,
    city: snapshot.city,
    state: snapshot.state,
    postal_code: snapshot.postalCode,
    latitude: snapshot.latitude,
    longitude: snapshot.longitude,
    source: snapshot.source,
    geocode_attempted: snapshot.geocodeAttempted,
  }
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function stringField(row: Record<string, unknown>, key: string): string | null {
  const value = row[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function asRecords(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return []
  return data.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
}

function asRecord(data: unknown): Record<string, unknown> {
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {}
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&")
}
