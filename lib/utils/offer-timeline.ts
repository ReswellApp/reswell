import type { OfferTimelineEntry } from "@/lib/types/offer-timeline"

function parseMoneyField(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === "number" ? v : Number.parseFloat(String(v))
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/** Normalizes JSONB from DB into a sorted timeline (defensive). */
export function parseOfferTimeline(raw: unknown): OfferTimelineEntry[] {
  if (!Array.isArray(raw)) return []
  const out: OfferTimelineEntry[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const id = typeof item.id === "string" ? item.id : ""
    const sender_id = typeof item.sender_id === "string" ? item.sender_id : ""
    const sender_role = item.sender_role === "SELLER" ? "SELLER" : "BUYER"
    const action = typeof item.action === "string" ? item.action : ""
    const created_at = typeof item.created_at === "string" ? item.created_at : ""
    if (!id || !sender_id || !action || !created_at) continue
    const note =
      typeof item.note === "string" && item.note.trim() !== "" ? item.note.trim().slice(0, 200) : null
    out.push({
      id,
      sender_id,
      sender_role,
      action,
      amount: parseMoneyField(item.amount),
      note,
      created_at,
    })
  }
  out.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  return out
}

/** Latest seller counter note (dashboard / buyer dialog) when status is COUNTERED. */
export function latestSellerCounterNoteFromTimeline(raw: unknown): string | null {
  const timeline = parseOfferTimeline(raw)
  for (let i = timeline.length - 1; i >= 0; i--) {
    const e = timeline[i]
    if (e.sender_role === "SELLER" && e.action === "COUNTER") {
      return e.note
    }
  }
  return null
}

/** First buyer opening offer event (mirrored thread repair). Seller-initiated rows may omit this. */
export function firstBuyerOfferFromTimeline(raw: unknown): OfferTimelineEntry | undefined {
  return parseOfferTimeline(raw).find((e) => e.action === "OFFER" && e.sender_role === "BUYER")
}

/** Note attached to the opening offer row linked by `messages.offer_id`. */
export function openingOfferNoteFromTimeline(
  raw: unknown,
  options?: { sellerInitiated?: boolean },
): string | null {
  const timeline = parseOfferTimeline(raw)
  if (options?.sellerInitiated) {
    const sellerOpen = timeline.find((e) => e.sender_role === "SELLER" && e.action === "COUNTER")
    return sellerOpen?.note ?? null
  }
  const buyerOpen = firstBuyerOfferFromTimeline(raw)
  if (buyerOpen?.note) return buyerOpen.note
  for (const entry of timeline) {
    if (entry.note) return entry.note
  }
  return null
}
