import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  CoastalDeliveryChoiceView,
  CoastalDirection,
  CoastalListingHit,
  CoastalListingPreview,
  CoastalRunView,
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

const STOP_SELECT = "id, slug, name, sort_order, active"
const SHIPPER_SELECT = "id, user_id, display_name, phone, notes, schedule_enabled"
const RUN_SELECT = "id, shipper_id, day_of_week, direction, enabled"
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
    supabase.from("coastal_shipper_runs").select(RUN_SELECT),
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
      status: "waiting_for_run",
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

async function resolveRunId(
  supabase: SupabaseClient,
  input: {
    shipperId: string
    runId?: string
    dayOfWeek: number
    direction: CoastalDirection
    enabled: boolean
  },
): Promise<string> {
  const patch = {
    day_of_week: input.dayOfWeek,
    direction: input.direction,
    enabled: input.enabled,
  }

  if (input.runId) {
    const { data, error } = await supabase
      .from("coastal_shipper_runs")
      .update(patch)
      .eq("id", input.runId)
      .eq("shipper_id", input.shipperId)
      .select("id")
      .maybeSingle()
    if (error) throw friendlyRunError(error)
    const id = asRecord(data).id
    if (typeof id !== "string") throw new Error("Run not found.")
    return id
  }

  const { data: existing, error: existingError } = await supabase
    .from("coastal_shipper_runs")
    .select("id")
    .eq("shipper_id", input.shipperId)
    .eq("day_of_week", input.dayOfWeek)
    .eq("direction", input.direction)
    .maybeSingle()
  if (existingError) throw existingError

  const existingId = asRecord(existing).id
  if (typeof existingId === "string") {
    const { error } = await supabase.from("coastal_shipper_runs").update(patch).eq("id", existingId)
    if (error) throw friendlyRunError(error)
    return existingId
  }

  const { data, error } = await supabase
    .from("coastal_shipper_runs")
    .insert({ shipper_id: input.shipperId, ...patch })
    .select("id")
    .single()
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
  }
}

function mapRun(row: Record<string, unknown>, stopIds: string[]): CoastalRunView | null {
  const id = stringField(row, "id")
  const direction = row.direction === "northbound" || row.direction === "southbound" ? row.direction : null
  const dayOfWeek = typeof row.day_of_week === "number" ? row.day_of_week : Number(row.day_of_week)
  if (!id || !direction || !Number.isInteger(dayOfWeek)) return null
  return { id, dayOfWeek, direction, enabled: row.enabled === true, stopIds }
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
    status: "waiting_for_run",
  }
}

function friendlyRunError(error: { message: string; code?: string }): Error {
  if (error.code === "23505") {
    return new Error("You already have a run that day in that direction.")
  }
  return new Error(error.message || "Could not save that run.")
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
