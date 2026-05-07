/** Preserves ordering from `order` keys; skips unknown IDs. */
export function sortRecordsByIdOrder<T extends { id: string }>(rows: T[], order: string[]): T[] {
  const map = new Map(rows.map((r) => [r.id, r]))
  const out: T[] = []
  for (const id of order) {
    const r = map.get(id)
    if (r) out.push(r)
  }
  return out
}
