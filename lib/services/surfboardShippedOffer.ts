import { requireAdmin } from "@/lib/brands/admin-server"
import { listCoastalShipperSchedules, listCoastalStops } from "@/lib/db/coastal-delivery"
import type { CoastalShipperScheduleRecord } from "@/lib/db/coastal-delivery"
import {
  fetchListingSurfboardShipped,
  fetchProfileAddressById,
  saveSurfboardShippedPickupAddress,
  setListingSurfboardShipped,
} from "@/lib/db/surfboard-shipped"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import type { ProfileAddressRow } from "@/lib/profile-address"
import type { CoastalMatchShipper } from "@/lib/services/coastalDeliveryMatch"
import {
  SURFBOARD_SHIPPED_FEE_CENTS,
  SURFBOARD_SHIPPED_FEE_USD,
  attachSurfboardShippedShipper,
  isCaliforniaAddressState,
  liveSurfboardShippers,
  surfboardShippedWindow,
  type LiveSurfboardShipper,
  type SurfboardShippedWindow,
} from "@/lib/services/surfboardShipped"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { toE164UsPhone } from "@/lib/utils/phone-e164-us"
import type { SaveListingSurfboardShippedInput } from "@/lib/validations/surfboard-shipped"

export type SurfboardShippedSellOffer = {
  liveShippers: LiveSurfboardShipper[]
}

export type SurfboardShippedCheckoutSeed = {
  feeUsd: number
  liveShippers: LiveSurfboardShipper[]
  pickupCity: string
  pickupState: string
}

export type SurfboardShippedCheckoutPreview = {
  available: boolean
  feeUsd: number
  window: SurfboardShippedWindow | null
  shippers: LiveSurfboardShipper[]
  matchedShipperName: string | null
  matchedWeekday: string | null
}

export type SurfboardShippedCharge = {
  feeUsd: number
  feeCents: number
  shipperId: string
  runId: string
  windowStart: string
  windowEnd: string
}

const UNAVAILABLE = "Surfboard Shipped is not available."

export async function getSurfboardShippedSellOffer(): Promise<SurfboardShippedSellOffer | null> {
  const gate = await requireAdmin()
  if (!gate.ok) return null

  try {
    const shippers = await loadMatchShippers()
    const live = liveSurfboardShippers(shippers)
    if (live.length === 0) return null
    return { liveShippers: live }
  } catch (error) {
    console.error("[surfboard-shipped] sell offer", error)
    return null
  }
}

export async function saveListingSurfboardShipped(
  input: SaveListingSurfboardShippedInput,
): Promise<{ error: string | null }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    const listing = await fetchListingSurfboardShipped(db, input.listingId)
    if (listing.error) return { error: "Could not save Surfboard Shipped." }
    if (!listing.row || listing.row.section !== "surfboards") {
      return { error: "Listing not found." }
    }

    if (!input.enabled) {
      const cleared = await setListingSurfboardShipped(db, input.listingId, {
        optedIn: false,
        pickupAddressId: null,
      })
      return { error: cleared.error }
    }

    const shippers = await loadMatchShippers()
    if (liveSurfboardShippers(shippers).length === 0) {
      return { error: "Surfboard Shipped is hidden until a coastal shipper is live." }
    }

    const addressInput = input.address
    if (!addressInput) return { error: "Add a California pickup name, phone, and address." }

    const phone = toE164UsPhone(addressInput.phone)
    if (!phone) return { error: "Enter a US phone number." }
    if (!isCaliforniaAddressState(addressInput.state)) {
      return { error: "Pickup must be in California." }
    }

    const ownedAddressId = input.addressId
      ? (await fetchProfileAddressById(db, listing.row.userId, input.addressId))?.id ?? null
      : null

    const saved = await saveSurfboardShippedPickupAddress(
      db,
      listing.row.userId,
      {
        full_name: addressInput.full_name,
        phone,
        line1: addressInput.line1,
        line2: addressInput.line2?.trim() || null,
        city: addressInput.city,
        state: addressInput.state,
        postal_code: addressInput.postal_code,
        country: "US",
      },
      ownedAddressId,
    )
    if (saved.error || !saved.address) {
      return { error: saved.error ?? "Could not save the pickup address." }
    }

    const updated = await setListingSurfboardShipped(db, input.listingId, {
      optedIn: true,
      pickupAddressId: saved.address.id,
    })
    return { error: updated.error }
  } catch (error) {
    console.error("[surfboard-shipped] save listing", {
      listingId: input.listingId,
      message: error instanceof Error ? error.message : "unknown",
    })
    return { error: "Could not save Surfboard Shipped." }
  }
}

export async function getListingSurfboardShippedChoice(listingId: string): Promise<{
  enabled: boolean
  address: ProfileAddressRow | null
} | null> {
  const gate = await requireAdmin()
  if (!gate.ok) return null

  try {
    const db = createServiceRoleClient()
    const listing = await fetchListingSurfboardShipped(db, listingId)
    if (listing.error || !listing.row) return { enabled: false, address: null }
    if (!listing.row.optedIn || !listing.row.pickupAddressId) {
      return { enabled: false, address: null }
    }
    const address = await fetchProfileAddressById(
      db,
      listing.row.userId,
      listing.row.pickupAddressId,
    )
    return { enabled: true, address }
  } catch (error) {
    console.error("[surfboard-shipped] load choice", error)
    return null
  }
}

export async function getSurfboardShippedCheckoutSeed(
  listingId: string,
): Promise<SurfboardShippedCheckoutSeed | null> {
  const session = await adminSession()
  if (!session) return null

  try {
    const db = createServiceRoleClient()
    const loaded = await loadOptedInPickup(db, listingId)
    if (!loaded) return null
    const shippers = liveSurfboardShippers(await loadMatchShippers())
    if (shippers.length === 0) return null
    return {
      feeUsd: SURFBOARD_SHIPPED_FEE_USD,
      liveShippers: shippers,
      pickupCity: loaded.pickup.city,
      pickupState: loaded.pickup.state ?? "CA",
    }
  } catch (error) {
    console.error("[surfboard-shipped] checkout seed", error)
    return null
  }
}

export async function previewSurfboardShippedCheckout(input: {
  listingId: string
  addressId: string
}): Promise<SurfboardShippedCheckoutPreview> {
  const hidden: SurfboardShippedCheckoutPreview = {
    available: false,
    feeUsd: SURFBOARD_SHIPPED_FEE_USD,
    window: null,
    shippers: [],
    matchedShipperName: null,
    matchedWeekday: null,
  }

  const session = await adminSession()
  if (!session) return hidden

  const { data: address, error } = await session.supabase
    .from("addresses")
    .select("*")
    .eq("id", input.addressId)
    .eq("profile_id", session.userId)
    .maybeSingle()

  if (error || !address) return hidden
  const buyer = address as ProfileAddressRow
  if (!isCaliforniaAddressState(buyer.state)) return hidden

  try {
    const charge = await buildCharge(input.listingId, buyer.city, buyer.state)
    if (!charge) return hidden
    return {
      available: true,
      feeUsd: charge.feeUsd,
      window: charge.window,
      shippers: charge.shippers,
      matchedShipperName: charge.matchedShipperName,
      matchedWeekday: charge.matchedWeekday,
    }
  } catch (caught) {
    console.error("[surfboard-shipped] preview", caught)
    return hidden
  }
}

export async function prepareSurfboardShippedCharge(input: {
  listingId: string
  buyerCity: string
  buyerState: string | null
}): Promise<
  { ok: true; charge: SurfboardShippedCharge } | { ok: false; error: string; status: number }
> {
  const session = await adminSession()
  if (!session) return { ok: false, error: UNAVAILABLE, status: 403 }

  try {
    const charge = await buildCharge(input.listingId, input.buyerCity, input.buyerState)
    if (!charge) return { ok: false, error: UNAVAILABLE, status: 422 }
    return {
      ok: true,
      charge: {
        feeUsd: charge.feeUsd,
        feeCents: SURFBOARD_SHIPPED_FEE_CENTS,
        shipperId: charge.shipperId,
        runId: charge.runId,
        windowStart: charge.window.startDate,
        windowEnd: charge.window.endDate,
      },
    }
  } catch (error) {
    console.error("[surfboard-shipped] prepare charge", {
      listingId: input.listingId,
      message: error instanceof Error ? error.message : "unknown",
    })
    return { ok: false, error: UNAVAILABLE, status: 422 }
  }
}

async function adminSession(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const isAdmin = await fetchProfileIsAdmin(supabase, user.id)
  if (!isAdmin) return null
  return { supabase, userId: user.id }
}

async function loadMatchShippers(): Promise<CoastalMatchShipper[]> {
  const db = createServiceRoleClient()
  const schedules = await listCoastalShipperSchedules(db)
  return schedules.map(scheduleToMatchShipper)
}

async function loadOptedInPickup(
  db: ReturnType<typeof createServiceRoleClient>,
  listingId: string,
): Promise<{ pickup: ProfileAddressRow } | null> {
  const listing = await fetchListingSurfboardShipped(db, listingId)
  if (listing.error || !listing.row?.optedIn || !listing.row.pickupAddressId) return null
  if (listing.row.section !== "surfboards") return null
  const pickup = await fetchProfileAddressById(db, listing.row.userId, listing.row.pickupAddressId)
  if (!pickup || !isCaliforniaAddressState(pickup.state)) return null
  return { pickup }
}

async function buildCharge(
  listingId: string,
  buyerCity: string,
  buyerState: string | null,
): Promise<{
  feeUsd: number
  shipperId: string
  runId: string
  window: SurfboardShippedWindow
  shippers: LiveSurfboardShipper[]
  matchedShipperName: string
  matchedWeekday: string
} | null> {
  if (!isCaliforniaAddressState(buyerState)) return null
  const db = createServiceRoleClient()
  const [stops, shippers, pickup] = await Promise.all([
    listCoastalStops(db),
    loadMatchShippers(),
    loadOptedInPickup(db, listingId),
  ])
  if (!pickup) return null
  if (liveSurfboardShippers(shippers).length === 0) return null

  const attached = attachSurfboardShippedShipper({
    pickupCity: pickup.pickup.city,
    dropoffCity: buyerCity,
    stops,
    shippers,
    now: new Date(),
  })
  if (!attached) return null

  return {
    feeUsd: SURFBOARD_SHIPPED_FEE_USD,
    shipperId: attached.shipperId,
    runId: attached.runId,
    window: surfboardShippedWindow(new Date()),
    shippers: attached.availableShippers,
    matchedShipperName: attached.displayName,
    matchedWeekday: attached.weekdayLabel,
  }
}

function scheduleToMatchShipper(schedule: CoastalShipperScheduleRecord): CoastalMatchShipper {
  return {
    shipperId: schedule.id,
    displayName: schedule.displayName,
    scheduleEnabled: schedule.scheduleEnabled,
    runs: schedule.runs.map((run) => ({
      id: run.id,
      dayOfWeek: run.dayOfWeek,
      direction: run.direction,
      enabled: run.enabled,
      stopIds: run.stopIds,
    })),
  }
}

