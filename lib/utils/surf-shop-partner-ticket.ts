import { FOR_SURF_SHOPS_OFFER_MONTHS } from "@/lib/for-surf-shops"
import type { SurfShopPartnerApplicationInput } from "@/lib/validations/surfShopPartner"

export const SURF_SHOP_PARTNER_SUBJECT = "Surf shop partner offer"

export const SURF_SHOP_PARTNER_OPS_NOTE =
  "Ops: confirm this is a real surf shop, then grant marketplace fee waiver (is_reswell_seller) for the offer window."

/** Customer-visible application body — never include staff ops copy. */
export function buildSurfShopPartnerCustomerMessage(
  input: SurfShopPartnerApplicationInput,
): string {
  const lines = [
    `Surf shop partner application — ${FOR_SURF_SHOPS_OFFER_MONTHS} months no selling fees`,
    "",
    `Contact name: ${input.name}`,
    `Shop name: ${input.shopName}`,
    `Email: ${input.email}`,
    `City: ${input.city}`,
  ]

  if (input.website) {
    lines.push(`Website / Instagram: ${input.website}`)
  }
  if (input.boardCount) {
    lines.push(`Approx. boards to list: ${input.boardCount}`)
  }
  if (input.message) {
    lines.push("", "Note from the shop:", input.message)
  }

  return lines.join("\n")
}

/** Staff-only waiver steps. Keep off the member thread and Klaviyo customer `message`. */
export function buildSurfShopPartnerOpsNotes(args?: {
  sessionEmail?: string | null
  workEmail?: string | null
}): string {
  const sessionEmail = (args?.sessionEmail ?? "").trim()
  const workEmail = (args?.workEmail ?? "").trim()
  if (
    sessionEmail &&
    workEmail &&
    sessionEmail.toLowerCase() !== workEmail.toLowerCase()
  ) {
    return [
      SURF_SHOP_PARTNER_OPS_NOTE,
      `Applicant is signed in as ${sessionEmail}. Grant the waiver on that account, not by work email (${workEmail}) alone.`,
    ].join("\n")
  }
  return SURF_SHOP_PARTNER_OPS_NOTE
}

/** Link to the signed-in member only — never resolve another account from work email. */
export function surfShopPartnerLinkedUserId(
  sessionUser: { id?: string | null } | null | undefined,
): string | null {
  const id = sessionUser?.id?.trim()
  return id || null
}

/**
 * Klaviyo treats `email` and `external_id` as the same profile. Only send the
 * member id when it belongs to the submitted work address — otherwise the shop
 * inbox and the signed-in member get aliased.
 */
export function surfShopPartnerKlaviyoExternalId(args: {
  linkedUserId: string | null
  sessionEmail?: string | null
  workEmail?: string | null
}): string | null {
  const linkedUserId = args.linkedUserId?.trim() || null
  if (!linkedUserId) return null
  const sessionEmail = (args.sessionEmail ?? "").trim()
  const workEmail = (args.workEmail ?? "").trim()
  if (
    !sessionEmail ||
    !workEmail ||
    sessionEmail.toLowerCase() !== workEmail.toLowerCase()
  ) {
    return null
  }
  return linkedUserId
}
