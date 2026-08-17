/**
 * Shared helpers for seller checkout Klaviyo events (ship-to parsing, URLs, label workflow).
 */

import { createServiceRoleClient } from "@/lib/supabase/server"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import {
  effectiveBoardShippingMode,
  type PeerListingForShippingQuote,
} from "@/lib/services/peerListingShippingQuote"

export type KlaviyoShipToAddress = {
  name: string
  phone: string
  email: string
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
  /** Multi-line block for email templates. */
  formatted: string
}

export type SellerShippingLabelWorkflow = "reswell" | "seller_own"

function displayNameFromProfileRow(data: {
  display_name?: string | null
  shop_name?: string | null
  is_shop?: boolean | null
} | null): string {
  if (!data) return ""
  const shop = typeof data.shop_name === "string" ? data.shop_name.trim() : ""
  if (data.is_shop && shop) return shop
  const dn = typeof data.display_name === "string" ? data.display_name.trim() : ""
  return dn || "Buyer"
}

export async function getBuyerDisplayNameForKlaviyo(buyerId: string): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "Buyer"
  }
  try {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from("profiles")
      .select("display_name, shop_name, is_shop")
      .eq("id", buyerId)
      .maybeSingle()
    const name = displayNameFromProfileRow(data ?? null)
    return name || "Buyer"
  } catch {
    return "Buyer"
  }
}

export async function getSellerEmailForKlaviyo(sellerId: string): Promise<string | null> {
  return getAuthEmailForUserId(sellerId)
}

export function sellerSaleUrl(orderId: string): string {
  return `${publicSiteOrigin()}/dashboard/sales/${orderId}`
}

export function sellerShippingToolsUrl(): string {
  return `${publicSiteOrigin()}/shipping`
}

export function parseOrderShippingAddressForKlaviyo(
  raw: Record<string, unknown> | null | undefined,
): KlaviyoShipToAddress | null {
  if (!raw || typeof raw !== "object") return null

  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : ""
  const email = typeof raw.email === "string" ? raw.email.trim() : ""

  const rawAddr = raw.address
  const addr =
    rawAddr && typeof rawAddr === "object" && !Array.isArray(rawAddr)
      ? (rawAddr as Record<string, string | null | undefined>)
      : null

  if (!addr) return null

  const line1 = typeof addr.line1 === "string" ? addr.line1.trim() : ""
  const line2 = typeof addr.line2 === "string" ? addr.line2.trim() : ""
  const city = typeof addr.city === "string" ? addr.city.trim() : ""
  const state = typeof addr.state === "string" ? addr.state.trim() : ""
  const postal_code = typeof addr.postal_code === "string" ? addr.postal_code.trim() : ""
  const country = typeof addr.country === "string" ? addr.country.trim().toUpperCase() : ""

  if (!line1 && !city && !postal_code) return null

  const formatted = [
    name || null,
    line1 || null,
    line2 || null,
    [city, state, postal_code].filter(Boolean).join(", ").trim() || null,
    country || null,
    phone ? `Phone: ${phone}` : null,
    email ? `Email: ${email}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n")

  return {
    name,
    phone,
    email,
    line1,
    line2,
    city,
    state,
    postal_code,
    country,
    formatted,
  }
}

/** Reswell auto-label when any line uses Reswell-calculated shipping; else seller supplies label. */
export function resolveSellerShippingLabelWorkflow(
  listings: PeerListingForShippingQuote[],
): SellerShippingLabelWorkflow {
  if (listings.some((l) => effectiveBoardShippingMode(l) === "reswell")) {
    return "reswell"
  }
  return "seller_own"
}

export function sellerShippingLabelWorkflowInstructions(
  workflow: SellerShippingLabelWorkflow,
): string {
  if (workflow === "reswell") {
    return [
      "Reswell is preparing your shipping label for this order.",
      "You'll receive another email when the label is ready to download and print from your sale page.",
      "Package the item securely, attach the label, and drop off with the carrier.",
      "After drop-off, tracking updates automatically for the buyer. Earnings release 24 hours after delivery.",
    ].join(" ")
  }

  return [
    "This order uses seller-provided shipping — purchase and print your own label with tracking.",
    "Add the tracking number on your sale page when the package ships.",
    "Tracked shipping keeps the buyer covered under Purchase Protection and releases your earnings after delivery.",
    "Need help buying a label? Open Shipping tools from your dashboard.",
  ].join(" ")
}

export function sellerLocalPickupInstructions(): string {
  return [
    "Message the buyer in your order thread to agree on a pickup time and safe meeting place.",
    "When they arrive, open your sale page and verify their 6-digit pickup code to complete the handoff.",
    "Earnings release to your wallet after pickup is verified.",
  ].join(" ")
}
