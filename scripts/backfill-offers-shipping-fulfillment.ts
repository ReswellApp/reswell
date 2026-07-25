/**
 * Align open/accepted offers with current listing shipping (post Reswell / oversize backfill).
 *
 * - Shipping offers on pickup-only listings → local pickup
 * - Reswell listings → clear stale negotiated/flat shipping_amount (null = rate at checkout)
 * - Free listings → shipping_amount 0
 * - Flat listings → shipping_amount from listing.shipping_price
 *
 * Usage:
 *   npx tsx scripts/backfill-offers-shipping-fulfillment.ts --dry-run
 *   npx tsx scripts/backfill-offers-shipping-fulfillment.ts --apply
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { reconcileOfferFulfillmentWithListing } from "@/lib/offer-listing-shipping"
import { parseOfferLineItems } from "@/lib/types/offer-line-item"
import { createServiceRoleClient } from "@/lib/supabase/server"

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

type OfferRow = {
  id: string
  listing_id: string
  status: string
  fulfillment: string | null
  shipping_amount: number | string | null
  line_items: unknown
}

type ListingRow = {
  id: string
  shipping_available: boolean | null
  local_pickup: boolean | null
  shipping_price: number | string | null
  board_shipping_cost_mode: string | null
}

function amountsEqual(a: number | null, b: number | string | null): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  const bn = typeof b === "number" ? b : parseFloat(String(b))
  if (!Number.isFinite(bn)) return false
  return Math.round(a * 100) === Math.round(bn * 100)
}

async function main() {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const apply = process.argv.includes("--apply")
  if (!process.argv.includes("--dry-run") && !apply) {
    console.error("Usage: npx tsx scripts/backfill-offers-shipping-fulfillment.ts --dry-run|--apply")
    process.exit(1)
  }

  const service = createServiceRoleClient()
  const counts = { scanned: 0, updated: 0, skipped: 0, errors: 0, invalid: 0 }

  const pageSize = 200
  let from = 0

  for (;;) {
    const { data, error } = await service
      .from("offers")
      .select("id, listing_id, status, fulfillment, shipping_amount, line_items")
      .in("status", ["PENDING", "COUNTERED", "ACCEPTED"])
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error("Fetch offers failed:", error.message)
      process.exit(1)
    }

    const offers = (data ?? []) as OfferRow[]
    if (offers.length === 0) break

    const listingIds = [...new Set(offers.map((o) => o.listing_id))]
    const { data: listingRows, error: listErr } = await service
      .from("listings")
      .select(
        "id, shipping_available, local_pickup, shipping_price, board_shipping_cost_mode",
      )
      .in("id", listingIds)

    if (listErr) {
      console.error("Fetch listings failed:", listErr.message)
      process.exit(1)
    }

    const byListing = new Map(
      ((listingRows ?? []) as ListingRow[]).map((row) => [row.id, row] as const),
    )

    for (const offer of offers) {
      counts.scanned += 1
      const listing = byListing.get(offer.listing_id)
      if (!listing) {
        counts.skipped += 1
        continue
      }

      const lineItems = parseOfferLineItems(offer.line_items)
      const isBundle = !!lineItems && lineItems.length > 1
      const reconciled = reconcileOfferFulfillmentWithListing(offer.fulfillment, {
        shipping_available: isBundle ? false : listing.shipping_available,
        local_pickup: listing.local_pickup,
        shipping_price: listing.shipping_price,
        board_shipping_cost_mode: listing.board_shipping_cost_mode,
      })

      if (!reconciled.fulfillment) {
        counts.invalid += 1
        console.log(`[invalid] offer ${offer.id}: ${reconciled.reason}`)
        continue
      }

      const fulfillmentChanged = offer.fulfillment !== reconciled.fulfillment
      const amountChanged = !amountsEqual(reconciled.shippingAmount, offer.shipping_amount)
      if (!fulfillmentChanged && !amountChanged) {
        counts.skipped += 1
        continue
      }

      counts.updated += 1
      const note = [
        fulfillmentChanged
          ? `fulfillment ${offer.fulfillment ?? "null"}→${reconciled.fulfillment}`
          : null,
        amountChanged
          ? `shipping_amount ${String(offer.shipping_amount)}→${String(reconciled.shippingAmount)}`
          : null,
      ]
        .filter(Boolean)
        .join(", ")

      if (!apply) {
        console.log(`[dry-run] offer ${offer.id} (${offer.status}) ${note}`)
        continue
      }

      const { error: upErr } = await service
        .from("offers")
        .update({
          fulfillment: reconciled.fulfillment,
          shipping_amount: reconciled.shippingAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", offer.id)

      if (upErr) {
        counts.errors += 1
        console.error(`Update failed ${offer.id}:`, upErr.message)
      } else {
        console.log(`[apply] offer ${offer.id} (${offer.status}) ${note}`)
      }
    }

    from += offers.length
    if (offers.length < pageSize) break
  }

  console.log("\nDone.", apply ? "(applied)" : "(dry-run — no writes)", counts)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
