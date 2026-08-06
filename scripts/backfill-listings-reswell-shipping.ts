/**
 * Backfill peer listings onto Reswell-calculated shipping (or local pickup when oversize).
 *
 * - Surfboards with shipping that fit a shortboard pack band → `reswell` + pack band parcel
 * - Surfboards that exceed UPS DIM / pack band fit → local pickup only
 * - Clears legacy BoardShipper tier-based flat rates
 * - Gear with shipping + packed dims → `reswell` when still on free/flat
 *
 * Usage:
 *   npx tsx scripts/backfill-listings-reswell-shipping.ts --dry-run
 *   npx tsx scripts/backfill-listings-reswell-shipping.ts --apply
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { parseListingDimensionsColumn } from "@/lib/listing-dimensions-storage"
import {
  surfboardShippingPackBandFixedParcel,
  type SurfboardShippingPackBandId,
  resolveSurfboardUpsShippingAvailability,
} from "@/lib/surfboard-shipping-pack-bands"
import { createServiceRoleClient } from "@/lib/supabase/server"

const PEER_GEAR_SECTIONS = [
  "fins",
  "accessories",
  "apparel",
  "boardbags",
  "leashes",
  "surfpacks",
  "wetsuits",
] as const

function loadEnvFile(relativePath: string): void {
  const filePath = resolve(process.cwd(), relativePath)
  try {
    const content = readFileSync(filePath, "utf8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!value) continue
      if (process.env[key]?.trim()) continue
      process.env[key] = value
    }
  } catch {
    // optional
  }
}

type ListingRow = {
  id: string
  section: string
  status: string | null
  dimensions: string | null
  shipping_available: boolean | null
  local_pickup: boolean | null
  shipping_price: number | string | null
  board_shipping_cost_mode: string | null
  shipping_package_tier: string | null
  shipping_package_band: string | null
  shipping_packed_length_in: number | null
  shipping_packed_width_in: number | null
  shipping_packed_height_in: number | null
  shipping_packed_weight_oz: number | null
}

function pickupOnlyPatch(): Record<string, unknown> {
  return {
    shipping_available: false,
    local_pickup: true,
    board_shipping_cost_mode: null,
    shipping_price: null,
    shipping_package_tier: null,
    shipping_package_band: null,
    shipping_packed_length_in: null,
    shipping_packed_width_in: null,
    shipping_packed_height_in: null,
    shipping_packed_weight_oz: null,
    updated_at: new Date().toISOString(),
  }
}

function reswellPackBandPatch(bandId: SurfboardShippingPackBandId): Record<string, unknown> {
  const parcel = surfboardShippingPackBandFixedParcel(bandId)
  return {
    shipping_available: true,
    board_shipping_cost_mode: "reswell",
    shipping_price: 0,
    shipping_package_tier: "shortboard",
    shipping_package_band: bandId,
    shipping_packed_length_in: parcel.lengthIn,
    shipping_packed_width_in: parcel.widthIn,
    shipping_packed_height_in: parcel.heightIn,
    shipping_packed_weight_oz: parcel.weightLb * 16,
    updated_at: new Date().toISOString(),
  }
}

function needsSurfboardBackfill(row: ListingRow): boolean {
  if (!row.shipping_available) {
    // Still clear orphaned BoardShipper / mode fields on pickup-only rows
    return (
      row.board_shipping_cost_mode != null ||
      row.shipping_package_tier != null ||
      row.shipping_package_band != null
    )
  }
  if (row.board_shipping_cost_mode !== "reswell") return true
  if (row.shipping_package_tier && row.shipping_package_tier !== "shortboard") return true
  if (!row.shipping_package_band) return true
  if (
    row.shipping_packed_length_in == null ||
    row.shipping_packed_width_in == null ||
    row.shipping_packed_height_in == null
  ) {
    return true
  }
  return false
}

function planSurfboardUpdate(row: ListingRow): { action: string; patch: Record<string, unknown> } | null {
  if (!needsSurfboardBackfill(row)) return null

  if (!row.shipping_available) {
    return { action: "clear_orphaned_shipping_fields", patch: pickupOnlyPatch() }
  }

  const dims = parseListingDimensionsColumn(row.dimensions)
  const boardLength = dims?.boardLength?.trim() ?? ""
  const boardWidthInches = dims?.boardWidthInches?.trim() ?? ""
  const avail = resolveSurfboardUpsShippingAvailability({
    boardLength,
    boardWidthInches: boardWidthInches || undefined,
  })

  if (!avail.shippingSupported) {
    return { action: "oversized_to_pickup", patch: pickupOnlyPatch() }
  }

  const bandId: SurfboardShippingPackBandId =
    avail.suggestedPackBandId || "shortboard_medium"
  return { action: "to_reswell_pack_band", patch: reswellPackBandPatch(bandId) }
}

function planGearUpdate(row: ListingRow): { action: string; patch: Record<string, unknown> } | null {
  if (!row.shipping_available) return null
  const mode = row.board_shipping_cost_mode?.trim() ?? ""
  if (mode === "reswell") return null

  const hasPacked =
    row.shipping_packed_length_in != null &&
    row.shipping_packed_width_in != null &&
    row.shipping_packed_height_in != null &&
    row.shipping_packed_weight_oz != null

  if (!hasPacked) {
    // Leave free/flat without dims alone — next seller edit will require Reswell dims.
    return null
  }

  return {
    action: "gear_to_reswell",
    patch: {
      board_shipping_cost_mode: "reswell",
      shipping_price: 0,
      shipping_package_tier: null,
      shipping_package_band: null,
      updated_at: new Date().toISOString(),
    },
  }
}

async function main() {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const apply = process.argv.includes("--apply")
  const dryRun = !apply
  if (!process.argv.includes("--dry-run") && !apply) {
    console.error("Usage: npx tsx scripts/backfill-listings-reswell-shipping.ts --dry-run|--apply")
    process.exit(1)
  }

  const service = createServiceRoleClient()
  const counts = {
    scanned: 0,
    oversizedToPickup: 0,
    toReswell: 0,
    gearToReswell: 0,
    clearedOrphan: 0,
    skipped: 0,
    errors: 0,
  }

  const pageSize = 200
  let from = 0

  for (;;) {
    const { data, error } = await service
      .from("listings")
      .select(
        "id, section, status, dimensions, shipping_available, local_pickup, shipping_price, board_shipping_cost_mode, shipping_package_tier, shipping_package_band, shipping_packed_length_in, shipping_packed_width_in, shipping_packed_height_in, shipping_packed_weight_oz",
      )
      .in("section", ["surfboards", ...PEER_GEAR_SECTIONS])
      .in("status", ["active", "draft", "pending_sale", "paused"])
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error("Fetch failed:", error.message)
      process.exit(1)
    }

    const rows = (data ?? []) as ListingRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      counts.scanned += 1
      const plan =
        row.section === "surfboards" ? planSurfboardUpdate(row) : planGearUpdate(row)

      if (!plan) {
        counts.skipped += 1
        continue
      }

      if (plan.action === "oversized_to_pickup") counts.oversizedToPickup += 1
      else if (plan.action === "to_reswell_pack_band") counts.toReswell += 1
      else if (plan.action === "gear_to_reswell") counts.gearToReswell += 1
      else if (plan.action === "clear_orphaned_shipping_fields") counts.clearedOrphan += 1

      if (dryRun) {
        console.log(`[dry-run] ${row.id} (${row.section}) → ${plan.action}`)
        continue
      }

      const { error: updateErr } = await service.from("listings").update(plan.patch).eq("id", row.id)
      if (updateErr) {
        counts.errors += 1
        console.error(`Update failed ${row.id}:`, updateErr.message)
      } else {
        console.log(`[apply] ${row.id} (${row.section}) → ${plan.action}`)
      }
    }

    from += rows.length
    if (rows.length < pageSize) break
  }

  console.log("\nDone.", dryRun ? "(dry-run — no writes)" : "(applied)", counts)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
