import { requireAdmin } from "@/lib/brands/admin-server"
import {
  deleteCoastalDeliveryRequest,
  deleteCoastalShipperRun,
  getCoastalDeliveryRequest,
  getCoastalPreviewListing,
  getCoastalShipperByUserId,
  getCoastalShipperSchedule,
  listCoastalShipperSchedules,
  listCoastalStops,
  searchCoastalPreviewListings,
  setCoastalShipperScheduleEnabled,
  upsertCoastalDeliveryRequest,
  upsertCoastalShipperProfile,
  upsertCoastalShipperRun,
  type CoastalShipperScheduleRecord,
} from "@/lib/db/coastal-delivery"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type {
  CoastalDeliveryChoiceView,
  CoastalListingHit,
  CoastalListingPreview,
  CoastalMatchResult,
  CoastalShipperProfileView,
  CoastalShipperSummary,
  CoastalStopView,
} from "@/lib/types/coastal-delivery"
import type {
  CoastalMatchPreviewInput,
  CoastalRunInput,
  CoastalSaveDeliveryInput,
  CoastalShipperJoinInput,
} from "@/lib/validations/coastal-delivery"
import { matchCoastalShippers, suggestPickupStopId, type CoastalMatchShipper } from "@/lib/services/coastalDeliveryMatch"
import { resolveCoastalShipperGrantUserId } from "@/lib/services/coastalShipperAccess"
import { findUserIdByEmail } from "@/lib/services/resolveUserIdByEmail"

export type CoastalOverviewData = {
  stops: CoastalStopView[]
  shippers: CoastalShipperSummary[]
  joined: boolean
}

export type CoastalPreviewPageData = {
  query: string
  listings: CoastalListingHit[]
  listing: CoastalListingPreview | null
  listingMissing: boolean
  choice: CoastalDeliveryChoiceView | null
  stops: CoastalStopView[]
  initialMatch: CoastalMatchResult | null
}

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: string }

export async function getCoastalOverview(): Promise<Ok<CoastalOverviewData> | Err> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    const [stops, schedules] = await Promise.all([
      listCoastalStops(db),
      listCoastalShipperSchedules(db),
    ])
    const accounts = await loadShipperAccounts(
      db,
      schedules.map((schedule) => schedule.userId),
    )
    return {
      ok: true,
      data: {
        stops,
        shippers: schedules.map((schedule) => toSummary(schedule, gate.ctx.user.id, accounts.get(schedule.userId))),
        joined: schedules.some((schedule) => schedule.userId === gate.ctx.user.id),
      },
    }
  } catch (error) {
    return loggedFailure(error, "Could not load coastal delivery.")
  }
}

export async function getCoastalJoinState(): Promise<Ok<{ profile: CoastalShipperProfileView | null }> | Err> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    const schedule = await getCoastalShipperByUserId(db, gate.ctx.user.id)
    return { ok: true, data: { profile: schedule ? toProfile(schedule) : null } }
  } catch (error) {
    return loggedFailure(error, "Could not load the shipper profile.")
  }
}

export async function enrollCoastalShipperAccount(input: {
  email: string
  displayName: string
  phone?: string
  notes?: string
}): Promise<Ok<{ profile: CoastalShipperProfileView }> | Err> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    const email = input.email.trim()
    const { data, error } = await db
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .limit(2)
    if (error) throw error
    const profileIds = (Array.isArray(data) ? data : [])
      .map((row) => (row as { id?: unknown }).id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
    const authUserId = profileIds.length === 0 ? await findUserIdByEmail(db, email) : null
    const resolved = resolveCoastalShipperGrantUserId({ profileIds, authUserId })
    if ("error" in resolved) return { ok: false, error: resolved.error }
    await upsertCoastalShipperProfile(db, {
      userId: resolved.userId,
      displayName: input.displayName,
      phone: blankToNull(input.phone),
      notes: blankToNull(input.notes),
    })
    const schedule = await getCoastalShipperByUserId(db, resolved.userId)
    if (!schedule) return { ok: false, error: "Could not sign up that account." }
    return { ok: true, data: { profile: toProfile(schedule) } }
  } catch (error) {
    return loggedFailure(error, "Could not sign up that account.")
  }
}

export async function joinCoastalShipper(input: CoastalShipperJoinInput): Promise<Ok<{ profile: CoastalShipperProfileView }> | Err> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    await upsertCoastalShipperProfile(db, {
      userId: gate.ctx.user.id,
      displayName: input.displayName,
      phone: blankToNull(input.phone),
      notes: blankToNull(input.notes),
    })
    const schedule = await getCoastalShipperByUserId(db, gate.ctx.user.id)
    if (!schedule) return { ok: false, error: "Could not save the shipper profile." }
    return { ok: true, data: { profile: toProfile(schedule) } }
  } catch (error) {
    return loggedFailure(error, "Could not save the shipper profile.")
  }
}

export async function getCoastalSchedulePage(): Promise<
  Ok<{ profile: CoastalShipperProfileView | null; stops: CoastalStopView[] }> | Err
> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    const [stops, schedule] = await Promise.all([
      listCoastalStops(db),
      getCoastalShipperByUserId(db, gate.ctx.user.id),
    ])
    return { ok: true, data: { stops, profile: schedule ? toProfile(schedule) : null } }
  } catch (error) {
    return loggedFailure(error, "Could not load the weekly schedule.")
  }
}

export async function getCoastalShipperSchedulePage(
  shipperId: string,
): Promise<Ok<{ profile: CoastalShipperProfileView; stops: CoastalStopView[] }> | Err> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    const [stops, schedule] = await Promise.all([
      listCoastalStops(db),
      getCoastalShipperSchedule(db, { shipperId }),
    ])
    if (!schedule) return { ok: false, error: "That account is not signed up as a shipper." }
    const account = (await loadShipperAccounts(db, [schedule.userId])).get(schedule.userId)
    return { ok: true, data: { stops, profile: toProfile(schedule, account) } }
  } catch (error) {
    return loggedFailure(error, "Could not load the weekly schedule.")
  }
}

export async function setCoastalScheduleEnabled(input: {
  shipperId: string
  enabled: boolean
}): Promise<Ok<{ scheduleEnabled: boolean }> | Err> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    const schedule = await getCoastalShipperSchedule(db, { shipperId: input.shipperId })
    if (!schedule) return { ok: false, error: "That account is not signed up as a shipper." }
    await setCoastalShipperScheduleEnabled(db, schedule.id, input.enabled)
    return { ok: true, data: { scheduleEnabled: input.enabled } }
  } catch (error) {
    return loggedFailure(error, "Could not update the schedule.")
  }
}

export async function saveCoastalRun(input: CoastalRunInput): Promise<Ok<{ saved: true }> | Err> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  const stopIds = [...new Set(input.stopIds)]
  if (stopIds.length < 2) return { ok: false, error: "Pick at least two stops." }

  try {
    const db = createServiceRoleClient()
    const [stops, schedule] = await Promise.all([
      listCoastalStops(db),
      getCoastalShipperSchedule(db, { shipperId: input.shipperId }),
    ])
    if (!schedule) return { ok: false, error: "That account is not signed up as a shipper." }
    const known = new Set(stops.map((stop) => stop.id))
    if (stopIds.some((id) => !known.has(id))) return { ok: false, error: "One of those stops is not on the corridor." }

    await upsertCoastalShipperRun(db, {
      shipperId: schedule.id,
      runId: input.runId,
      dayOfWeek: input.dayOfWeek,
      direction: input.direction,
      enabled: input.enabled,
      stopIds,
    })
    return { ok: true, data: { saved: true } }
  } catch (error) {
    return loggedFailure(error, "Could not save that run.")
  }
}

export async function removeCoastalRun(input: {
  shipperId: string
  runId: string
}): Promise<Ok<{ deleted: true }> | Err> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    const schedule = await getCoastalShipperSchedule(db, { shipperId: input.shipperId })
    if (!schedule) return { ok: false, error: "That account is not signed up as a shipper." }
    await deleteCoastalShipperRun(db, schedule.id, input.runId)
    return { ok: true, data: { deleted: true } }
  } catch (error) {
    return loggedFailure(error, "Could not remove that run.")
  }
}

export async function getCoastalStops(): Promise<Ok<{ stops: CoastalStopView[] }> | Err> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    const stops = await listCoastalStops(db)
    return { ok: true, data: { stops } }
  } catch (error) {
    return loggedFailure(error, "Could not load stops.")
  }
}

export async function getCoastalPreviewPage(input: {
  query: string
  listingId: string
}): Promise<Ok<CoastalPreviewPageData> | Err> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    const query = input.query.trim().slice(0, 120)
    const listingId = input.listingId.trim()
    const [stops, listings, listingRow, choice, schedules] = await Promise.all([
      listCoastalStops(db),
      searchCoastalPreviewListings(db, query),
      listingId ? getCoastalPreviewListing(db, listingId) : Promise.resolve(null),
      listingId ? getCoastalDeliveryRequest(db, listingId) : Promise.resolve(null),
      listCoastalShipperSchedules(db),
    ])

    const listing = listingRow
      ? { ...listingRow, suggestedPickupStopId: suggestPickupStopId(listingRow.city, stops) }
      : null
    const pickupStopId = choice?.pickupStopId
    const dropoffStopId = choice?.dropoffStopId
    const initialMatch =
      pickupStopId && dropoffStopId
        ? matchStops(stops, schedules, pickupStopId, dropoffStopId)
        : null

    return {
      ok: true,
      data: {
        query,
        listings,
        listing,
        listingMissing: Boolean(listingId) && !listing,
        choice,
        stops,
        initialMatch: initialMatch && "reason" in initialMatch ? initialMatch : null,
      },
    }
  } catch (error) {
    return loggedFailure(error, "Could not load the listing preview.")
  }
}

export async function matchCoastalPreview(input: CoastalMatchPreviewInput): Promise<Ok<CoastalMatchResult> | Err> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    const [stops, schedules] = await Promise.all([
      listCoastalStops(db),
      listCoastalShipperSchedules(db),
    ])
    const matched = matchStops(stops, schedules, input.pickupStopId, input.dropoffStopId)
    if ("error" in matched) return matched
    return { ok: true, data: matched }
  } catch (error) {
    return loggedFailure(error, "Could not match shippers.")
  }
}

export async function saveCoastalDeliveryChoice(
  input: CoastalSaveDeliveryInput,
): Promise<Ok<{ saved: boolean }> | Err> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    const listing = await getCoastalPreviewListing(db, input.listingId)
    if (!listing) return { ok: false, error: "That surfboard listing is not available to preview." }

    if (!input.whiteGlove) {
      await deleteCoastalDeliveryRequest(db, input.listingId)
      return { ok: true, data: { saved: false } }
    }

    const pickupStopId = input.pickupStopId
    const dropoffStopId = input.dropoffStopId
    if (!pickupStopId || !dropoffStopId) {
      return { ok: false, error: "Choose a pickup stop and a drop-off stop." }
    }

    const schedules = await listCoastalShipperSchedules(db)
    const stops = await listCoastalStops(db)
    const matched = matchStops(stops, schedules, pickupStopId, dropoffStopId)
    if ("error" in matched) return matched

    const shipperId = input.shipperId ?? null
    const chosen = shipperId ? matched.matches.find((match) => match.shipperId === shipperId) : null
    if (shipperId && !chosen) {
      return { ok: false, error: "That shipper does not have an active run covering this route." }
    }

    await upsertCoastalDeliveryRequest(db, {
      listingId: input.listingId,
      pickupStopId,
      sellerOriginLabel: blankToNull(input.sellerOriginLabel),
      dropoffStopId,
      shipperId,
      matchedRunId: chosen?.runId ?? null,
      createdBy: gate.ctx.user.id,
    })
    return { ok: true, data: { saved: true } }
  } catch (error) {
    return loggedFailure(error, "Could not save coastal delivery for this listing.")
  }
}

function matchStops(
  stops: CoastalStopView[],
  schedules: CoastalShipperScheduleRecord[],
  pickupStopId: string,
  dropoffStopId: string,
): CoastalMatchResult | Err {
  const pickup = stops.find((stop) => stop.id === pickupStopId)
  const dropoff = stops.find((stop) => stop.id === dropoffStopId)
  if (!pickup || !dropoff) return { ok: false, error: "Choose stops on the corridor." }

  return matchCoastalShippers({
    pickup: { id: pickup.id, sortOrder: pickup.sortOrder },
    dropoff: { id: dropoff.id, sortOrder: dropoff.sortOrder },
    shippers: schedules.map(toMatchShipper),
    now: new Date(),
  })
}

function toMatchShipper(schedule: CoastalShipperScheduleRecord): CoastalMatchShipper {
  return {
    shipperId: schedule.id,
    displayName: schedule.displayName,
    scheduleEnabled: schedule.scheduleEnabled,
    runs: schedule.runs,
  }
}

function toProfile(
  schedule: CoastalShipperScheduleRecord,
  account?: { email: string | null; isShop: boolean },
): CoastalShipperProfileView {
  return {
    id: schedule.id,
    displayName: schedule.displayName,
    email: account?.email ?? null,
    isShop: account?.isShop === true,
    phone: schedule.phone,
    notes: schedule.notes,
    scheduleEnabled: schedule.scheduleEnabled,
    runs: schedule.runs,
  }
}

function toSummary(
  schedule: CoastalShipperScheduleRecord,
  userId: string,
  account: { email: string | null; isShop: boolean } | undefined,
): CoastalShipperSummary {
  return {
    id: schedule.id,
    displayName: schedule.displayName,
    email: account?.email ?? null,
    isShop: account?.isShop === true,
    scheduleEnabled: schedule.scheduleEnabled,
    runCount: schedule.runs.length,
    enabledRunCount: schedule.runs.filter((run) => run.enabled).length,
    isYou: schedule.userId === userId,
  }
}

async function loadShipperAccounts(
  db: ReturnType<typeof createServiceRoleClient>,
  userIds: string[],
): Promise<Map<string, { email: string | null; isShop: boolean }>> {
  const accounts = new Map<string, { email: string | null; isShop: boolean }>()
  if (userIds.length === 0) return accounts
  const { data, error } = await db.from("profiles").select("id, email, is_shop").in("id", userIds)
  if (error || !data) return accounts
  for (const row of data as { id?: string; email?: string | null; is_shop?: boolean | null }[]) {
    if (!row.id) continue
    accounts.set(row.id, {
      email: typeof row.email === "string" ? row.email : null,
      isShop: row.is_shop === true,
    })
  }
  return accounts
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : null
}

function loggedFailure(error: unknown, fallback: string): Err {
  const message = error instanceof Error ? error.message : fallback
  console.error("[coastal-delivery]", { message, at: new Date().toISOString() })
  if (message === "Run not found." || message.startsWith("You already have a run")) {
    return { ok: false, error: message }
  }
  return { ok: false, error: fallback }
}
