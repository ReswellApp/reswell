/**
 * US PO Box detection for carrier eligibility (UPS/FedEx reject these).
 */

const PO_BOX_PHRASE_RE =
  /\b(?:p\s*o|post\s*office)\s*box\b|\bpobox\b|\bpob\s*\d+/i

/** Bare "Box 123" is almost always a PO Box; "RR 1 Box 12" is rural delivery. */
const STANDALONE_BOX_RE = /^(?:p\s*o\s*)?box\s+\d+/

export function isUsPoBoxStreetLine(line: string | null | undefined): boolean {
  if (!line) return false
  const normalized = line
    .toLowerCase()
    .replace(/[#.,/\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!normalized) return false
  return PO_BOX_PHRASE_RE.test(normalized) || STANDALONE_BOX_RE.test(normalized)
}

export function addressRowLooksLikeUsPoBox(addr: {
  line1?: string | null
  line2?: string | null
}): boolean {
  return isUsPoBoxStreetLine(addr.line1) || isUsPoBoxStreetLine(addr.line2)
}
