import {
  ADMIN_ISSUED_PROMO_VALIDITY_DAYS,
} from "@/lib/constants/admin-issued-promo"
import {
  fetchAdminIssuedPromoByCode,
  insertAdminIssuedPromoCode,
  type AdminIssuedPromoCodeRow,
} from "@/lib/db/adminIssuedPromoCodes"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { generateAdminIssuedPromoCode } from "@/lib/utils/admin-issued-promo-code"
import {
  loadPromoCheckoutLinesForPreview,
  withResolvedPromoProductTypes,
} from "@/lib/services/promoProductType"
import {
  computeCheckoutTotalWithNewsletterPromo,
  computeNewsletterPromoItemDiscountUsd,
} from "@/lib/services/newsletterPromo"
import {
  computeRestrictedPromoCheckoutAmounts,
  eligiblePromoItemSubtotalUsd,
  normalizeAdminPromoEligibleSections,
  promoProductTypeRestrictionError,
  sumPromoLineSubtotalUsd,
  type PromoCheckoutLine,
} from "@/lib/utils/promo-product-type"
import type { PeerListingSection } from "@/lib/peer-listing-sections"

function promoExpiryIso(from = new Date()): string {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + ADMIN_ISSUED_PROMO_VALIDITY_DAYS)
  return d.toISOString()
}

function isPromoExpired(row: Pick<AdminIssuedPromoCodeRow, "expires_at">, now = new Date()): boolean {
  return new Date(row.expires_at).getTime() <= now.getTime()
}

export type AdminIssuedPromoValidationResult =
  | {
      ok: true
      promo: AdminIssuedPromoCodeRow
      discountPercent: number
      discountUsd: number
      totalUsd: number
      /** Null when the code discounts every product type. */
      appliesTo: PeerListingSection[] | null
    }
  | { ok: false; error: string }

export async function validateAdminIssuedPromoForCheckout(params: {
  code: string
  itemSubtotalUsd: number
  shippingUsd: number
  /** Already priced checkout lines. Payment creation passes these. */
  lines?: readonly PromoCheckoutLine[]
  /** Checkout preview loads prices here when the code is limited to a product type. */
  preview?: {
    buyerId: string
    offerId?: string | null
    requestedLines: readonly { id: string; quantity: number }[]
  }
}): Promise<AdminIssuedPromoValidationResult> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Promo codes are temporarily unavailable." }
  }

  const { row, error } = await fetchAdminIssuedPromoByCode(supabase, params.code)
  if (error) {
    console.error("[admin-issued-promo] fetch by code:", error)
    return { ok: false, error: "Could not verify promo code." }
  }
  if (!row) {
    return { ok: false, error: "That promo code is not valid." }
  }
  if (row.redeemed_at) {
    return { ok: false, error: "This promo code has already been used." }
  }
  if (isPromoExpired(row)) {
    return { ok: false, error: "This promo code has expired." }
  }

  const discountPercent = row.discount_percent
  const appliesTo = normalizeAdminPromoEligibleSections(row.eligible_sections)

  let itemSubtotalUsd = params.itemSubtotalUsd
  let eligibleItemSubtotalUsd = params.itemSubtotalUsd

  if (appliesTo) {
    let lines = params.lines
    if (!lines && params.preview) {
      const loaded = await loadPromoCheckoutLinesForPreview(supabase, params.preview)
      if (loaded.error) return { ok: false, error: loaded.error }
      lines = loaded.lines
    }
    if (!lines || lines.length === 0) {
      return { ok: false, error: promoProductTypeRestrictionError(appliesTo) }
    }
    const resolved = await withResolvedPromoProductTypes(supabase, lines)
    if (resolved.error) return { ok: false, error: resolved.error }
    lines = resolved.lines
    eligibleItemSubtotalUsd = eligiblePromoItemSubtotalUsd(lines, appliesTo)
    if (eligibleItemSubtotalUsd <= 0) {
      return { ok: false, error: promoProductTypeRestrictionError(appliesTo) }
    }
    if (!params.lines) {
      itemSubtotalUsd = sumPromoLineSubtotalUsd(lines)
    }
  }

  const { discountUsd, totalUsd } = appliesTo
    ? computeRestrictedPromoCheckoutAmounts({
        itemSubtotalUsd,
        eligibleItemSubtotalUsd,
        shippingUsd: params.shippingUsd,
        discountPercent,
      })
    : computeCheckoutTotalWithNewsletterPromo({
        itemSubtotalUsd,
        shippingUsd: params.shippingUsd,
        discountPercent,
      })

  if (totalUsd < 0.5) {
    return { ok: false, error: "Order total is below the minimum after discount." }
  }

  return {
    ok: true,
    promo: row,
    discountPercent,
    discountUsd,
    totalUsd,
    appliesTo,
  }
}

export type CreateAdminIssuedPromoResult =
  | { ok: true; promo: AdminIssuedPromoCodeRow }
  | { ok: false; error: string }

export async function createAdminIssuedPromoCode(params: {
  discountPercent: number
  createdByProfileId: string
  note?: string
  eligibleSections?: PeerListingSection[] | null
}): Promise<CreateAdminIssuedPromoResult> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Could not generate promo code." }
  }

  const expiresAt = promoExpiryIso()
  let codeRow: AdminIssuedPromoCodeRow | null = null
  let lastInsertError: string | null = null

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateAdminIssuedPromoCode()
    const inserted = await insertAdminIssuedPromoCode(supabase, {
      code,
      discountPercent: params.discountPercent,
      expiresAt,
      createdByProfileId: params.createdByProfileId,
      note: params.note,
      eligibleSections: params.eligibleSections,
    })
    if (inserted.row) {
      codeRow = inserted.row
      break
    }
    lastInsertError = inserted.error
    if (inserted.error && !inserted.error.toLowerCase().includes("duplicate")) {
      break
    }
  }

  if (!codeRow) {
    console.error("[admin-issued-promo] insert failed:", lastInsertError)
    return { ok: false, error: "Could not generate promo code. Try again." }
  }

  return { ok: true, promo: codeRow }
}

export { computeNewsletterPromoItemDiscountUsd as computeAdminIssuedPromoItemDiscountUsd }
