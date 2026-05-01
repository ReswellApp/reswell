import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { z } from "zod"
import {
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerListingForShippingQuote,
} from "@/lib/services/peerListingShippingQuote"
import { fetchSellerShipFromLabelName } from "@/lib/db/sellerShipFromLabel"
import {
  getCheapestReswellRateForListing,
  type ReswellRateableListing,
} from "@/lib/services/reswellListingShippingRate"
import type { ShippingAddressInput } from "@/lib/shipping/shipengine-rate-helpers"
import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"

export const dynamic = "force-dynamic"

const buyerSchema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  company_name: z.string().trim().max(120).optional().default(""),
  address_line1: z.string().trim().min(2).max(200),
  address_line2: z.string().trim().max(200).optional().default(""),
  city_locality: z.string().trim().min(2).max(100),
  state_province: z.string().trim().min(2).max(40),
  postal_code: z.string().trim().regex(/^\d{5}(-\d{4})?$/),
  country_code: z.literal("US"),
  residential: z.enum(["yes", "no", "unknown"]).default("no"),
})

/** Accepts a UUID (`listings.id`), a slug (`listings.slug`), or a public URL containing either. */
const bodySchema = z.object({
  listing_ref: z.string().trim().min(1),
  buyer: buyerSchema,
})

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function extractListingRefFromInput(raw: string): { kind: "id" | "slug"; value: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { kind: "slug", value: "" }

  let candidate = trimmed
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const u = new URL(candidate)
      const segments = u.pathname.split("/").filter(Boolean)
      const last = segments[segments.length - 1] ?? ""
      if (last) candidate = last
    } catch {
      // fallthrough to raw
    }
  }
  if (UUID_REGEX.test(candidate)) {
    return { kind: "id", value: candidate.toLowerCase() }
  }
  return { kind: "slug", value: candidate }
}

/**
 * Admin diagnostic: rates a saved listing against any buyer address using the EXACT same
 * path as `/checkout` (`getCheapestReswellRateForListing`). Returns the request payload sent
 * to ShipEngine, the cheapest row, and the top 5 sorted alternatives. Use this to confirm
 * the buyer-side number matches what `/admin/shipping` returns when given the same dims/lane.
 */
export async function POST(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  let serviceSupabase
  try {
    serviceSupabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server is not configured for admin lookups" }, { status: 503 })
  }

  const ref = extractListingRefFromInput(parsed.data.listing_ref)
  const selectFragment = `${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT}, slug`
  const baseQuery = serviceSupabase.from("listings").select(selectFragment)

  const { data: listing, error: listingError } =
    ref.kind === "id"
      ? await baseQuery.eq("id", ref.value).maybeSingle()
      : await baseQuery.eq("slug", ref.value).maybeSingle()

  if (listingError || !listing) {
    return NextResponse.json(
      { error: `Listing not found for ${ref.kind === "id" ? "id" : "slug"} \`${ref.value}\`` },
      { status: 404 },
    )
  }

  const buyer = parsed.data.buyer
  const shipTo: ShippingAddressInput = {
    name: buyer.name || "Recipient",
    phone: buyer.phone || "",
    company_name: buyer.company_name || "",
    address_line1: buyer.address_line1,
    address_line2: buyer.address_line2 || "",
    city_locality: buyer.city_locality,
    state_province: normalizeUsStateProvinceForShipping("US", buyer.state_province),
    postal_code: buyer.postal_code,
    country_code: "US",
    residential: buyer.residential,
  }

  const listingRow = listing as unknown as PeerListingForShippingQuote &
    ReswellRateableListing & {
      id: string
      user_id: string
      slug?: string | null
      title?: string | null
      shipping_packed_length_in?: number | string | null
      shipping_packed_width_in?: number | string | null
      shipping_packed_height_in?: number | string | null
      shipping_packed_weight_oz?: number | string | null
    }

  const sellerShipFromName = await fetchSellerShipFromLabelName(serviceSupabase, listingRow.user_id)

  const result = await getCheapestReswellRateForListing({
    listing: listingRow,
    shipTo,
    diagnosticTag: `admin:${listingRow.id}`,
    sellerShipFromName,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 })
  }

  return NextResponse.json({
    ok: true,
    listing: {
      id: listingRow.id,
      slug: listingRow.slug ?? null,
      title: listingRow.title ?? null,
    },
    /** Raw values currently persisted on `listings` — surfacing these makes it obvious when the rate is using heuristics because the seller never saved real packed measurements. */
    savedPackedFields: {
      shipping_packed_length_in: listingRow.shipping_packed_length_in ?? null,
      shipping_packed_width_in: listingRow.shipping_packed_width_in ?? null,
      shipping_packed_height_in: listingRow.shipping_packed_height_in ?? null,
      shipping_packed_weight_oz: listingRow.shipping_packed_weight_oz ?? null,
    },
    parcelSource: result.parcelSource,
    cheapest: result.cheapest,
    topRates: result.topRates.slice(0, 5),
    payload: result.payload,
  })
}
