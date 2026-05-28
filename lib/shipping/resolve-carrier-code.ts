/**
 * Maps free-text carrier hints and tracking-number patterns to ShipEngine carrier_code values.
 */
export function resolveShipEngineCarrierCode(
  trackingNumber: string,
  carrierHint: string | null | undefined,
): string | null {
  const hint = (carrierHint ?? "").trim().toLowerCase()
  const tn = trackingNumber.trim().replace(/\s/g, "")

  if (hint && /^[a-z0-9_]+$/.test(hint)) {
    return hint
  }

  if (hint.includes("usps") || hint.includes("postal") || hint.includes("post office")) {
    return "usps"
  }
  if (hint.includes("stamps")) {
    return "stamps_com"
  }
  if (hint.includes("ups")) {
    return "ups"
  }
  if (hint.includes("fedex") || hint.includes("fed ex")) {
    return "fedex"
  }
  if (hint.includes("dhl")) {
    return "dhl_express"
  }

  if (/^1Z/i.test(tn)) {
    return "ups"
  }
  if (/\b(94|93|92|420)[0-9]{18,}\b/.test(tn)) {
    return "usps"
  }

  return null
}

/** Human-readable carrier label for UI. */
export function formatCarrierDisplayName(
  carrierHint: string | null | undefined,
  carrierCode: string | null | undefined,
): string {
  const raw = (carrierHint ?? carrierCode ?? "").trim()
  if (!raw) return "Carrier"

  const lower = raw.toLowerCase()
  if (lower.includes("usps") || lower === "stamps_com") return "USPS"
  if (lower.includes("ups")) return "UPS"
  if (lower.includes("fedex")) return "FedEx"
  if (lower.includes("dhl")) return "DHL"

  return raw
    .replace(/_/g, " ")
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
