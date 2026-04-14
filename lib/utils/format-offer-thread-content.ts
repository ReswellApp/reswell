/** Single source for mirrored chat text so sync + create stay identical. */
export function formatOfferThreadContent(amount: number, note: string | null): string {
  const a = Number.isFinite(amount) ? amount : 0
  return note !== null && note.trim() !== ""
    ? `Offer: $${a.toFixed(2)} — ${note.trim()}`
    : `Offer: $${a.toFixed(2)}`
}
