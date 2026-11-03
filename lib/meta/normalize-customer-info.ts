/**
 * Meta Conversions API customer-info normalization before SHA-256 hashing.
 *
 * @see https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
 */

/**
 * Normalize an email the way Meta expects before hashing (`em`).
 * Lowercase + trim; for Gmail / Googlemail also strip local-part dots and `+` aliases.
 */
export function normalizeMetaEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !trimmed.includes("@")) return null

  const at = trimmed.lastIndexOf("@")
  let local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  if (!local || !domain) return null

  if (domain === "gmail.com" || domain === "googlemail.com") {
    const plus = local.indexOf("+")
    if (plus >= 0) local = local.slice(0, plus)
    local = local.replace(/\./g, "")
    if (!local) return null
    return `${local}@gmail.com`
  }

  return `${local}@${domain}`
}
