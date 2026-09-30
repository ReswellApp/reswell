import type {
  EmailProductBlock,
  EmailStudioProductSnapshot,
} from "@/lib/types/emailStudio"

export function reconcileEmailStudioProductBlock(
  block: EmailProductBlock,
  liveItems: readonly EmailStudioProductSnapshot[],
): EmailProductBlock {
  const liveById = new Map(liveItems.map((item) => [item.id, item]))
  const cachedById = new Map(block.items.map((item) => [item.id, item]))
  const selectedIds = [...new Set(block.listingIds)]
  const items = selectedIds.flatMap((id) => {
    const live = liveById.get(id)
    if (live) return [live]

    const cached = cachedById.get(id)
    return cached ? [{ ...cached, availability: "unavailable" as const }] : []
  })

  return {
    ...block,
    listingIds: items.map((item) => item.id),
    items,
  }
}
