/** Strip whitespace so carrier APIs receive compact tracking numbers (e.g. UPS 1Z…). */
export function normalizeTrackingNumberForCarrier(value: string): string {
  return value.trim().replace(/\s+/g, "")
}
