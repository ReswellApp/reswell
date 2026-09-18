/**
 * Stripe Connect rejects PO Boxes for identity / payout addresses
 * (`individual[address]`). Prefill must skip those so account creation still works.
 */
export { addressRowLooksLikeUsPoBox, isUsPoBoxStreetLine } from "../shipping/us-po-box.ts"

/** Stripe `param` / message when a prefilled street address is not allowed. */
export function isStripePrefillAddressRejection(error: {
  param?: string | null
  message?: string | null
}): boolean {
  const param = error.param ?? ""
  if (param.includes("address")) return true
  const message = error.message ?? ""
  return /post office box|p\.?\s*o\.?\s*box|physical address/i.test(message)
}
