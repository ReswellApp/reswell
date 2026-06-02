/**
 * Shared Meta Pixel event ids. The browser pixel and the Conversions API must send the SAME
 * `event_id` for the same logical event so Meta deduplicates the pair.
 *
 * Purchase is "once per order", so a deterministic id keyed on the order id lets both sides
 * agree without passing anything around. High-frequency events (AddToCart, ViewContent) use a
 * random id generated once and shared between the client fire and its matching server send.
 */

export function metaPurchaseEventId(orderId: string): string {
  return `purchase_${orderId.trim()}`
}
