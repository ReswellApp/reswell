import { parseInboxCaseParam } from "../utils/support-case-paths.ts"

export function firstNonEmptyText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = value?.replace(/\s+/g, " ").trim()
    if (text) return text
  }
  return ""
}

export type InboxSelectableItem = {
  key: string
  id?: string
  orderId?: string | null
  contact?: { id: string } | null
  order?: { id: string } | null
}

type InboxListItem = InboxSelectableItem

/** Keep the open conversation even when a reply moves it out of the current view. */
export function pinSelectedInboxItem<T extends InboxListItem>(
  filtered: T[],
  selected: T | null,
): T[] {
  if (!selected) return filtered
  if (filtered.some((item) => item.key === selected.key)) return filtered
  return [selected, ...filtered]
}

export function inboxItemMatchesSelection(
  item: InboxSelectableItem,
  selectedKey: string | null,
): boolean {
  if (!selectedKey) return false
  if (item.key === selectedKey) return true
  const raw = parseInboxCaseParam(selectedKey)
  if (!raw) return false
  return (
    item.id === raw ||
    item.contact?.id === raw ||
    item.order?.id === raw ||
    item.orderId === raw
  )
}

/** Resolve `sc:` / `cm:` / `os:` / raw ids to the inbox row they actually belong to. */
export function findInboxItemBySelection<T extends InboxSelectableItem>(
  items: T[],
  selectedKey: string | null,
): T | null {
  if (!selectedKey) return null
  return items.find((item) => inboxItemMatchesSelection(item, selectedKey)) ?? null
}

export function nextInboxSelectedKey(args: {
  items: InboxSelectableItem[]
  filtered: InboxSelectableItem[]
  selectedKey: string | null
  loading: boolean
}): string | undefined {
  if (args.loading) return undefined
  const matched = findInboxItemBySelection(args.items, args.selectedKey)
  if (matched) {
    return matched.key === args.selectedKey ? undefined : matched.key
  }
  if (args.selectedKey) {
    // Hold the unresolved ?case=. Returning null would clear selectedKey,
    // re-run this helper, and then pick filtered[0] — rewriting the URL.
    return undefined
  }
  if (args.filtered.length > 0) return args.filtered[0]!.key
  return undefined
}

export type InboxLoadMode = "initial" | "refresh" | "page"

export type InboxLoadQuery = {
  view: string
  type: string
  sort: string
  search: string
}

export function inboxLoadQueryKey(query: InboxLoadQuery): string {
  return `${query.view}\0${query.type}\0${query.sort}\0${query.search}`
}

export function shouldApplyInboxLoad(args: {
  mode: InboxLoadMode
  requestGeneration: number
  currentGeneration: number
  requestQueryKey: string
  currentQueryKey: string
}): boolean {
  // Live refresh does not bump generation, so an in-flight Load more still applies.
  // Initial (view/search reset) does, which drops a stale page even if the query matches again.
  if (args.requestGeneration !== args.currentGeneration) return false
  if (args.mode === "page") return args.requestQueryKey === args.currentQueryKey
  return true
}

export function mergeInboxPageItems<T extends { key: string }>(prev: T[], next: T[]): T[] {
  const seen = new Set(prev.map((item) => item.key))
  return [...prev, ...next.filter((item) => !seen.has(item.key))]
}

/** First-page poll: update those rows, keep conversations already loaded via Load more. */
export function mergeInboxRefreshItems<T extends { key: string }>(prev: T[], next: T[]): T[] {
  const seen = new Set(next.map((item) => item.key))
  return [...next, ...prev.filter((item) => !seen.has(item.key))]
}

export function applyInboxLoadItems<T extends { key: string }>(args: {
  mode: InboxLoadMode
  paged: boolean
  prev: T[]
  next: T[]
}): T[] {
  if (args.mode === "page") return mergeInboxPageItems(args.prev, args.next)
  if (args.mode === "refresh" && args.paged) return mergeInboxRefreshItems(args.prev, args.next)
  return args.next
}

export function inboxRefreshPagination(args: {
  paged: boolean
  loadedCount: number
  incomingCount: number
  currentHasMore: boolean
  incomingHasMore: boolean
  currentNextOffset: number
  incomingNextOffset: number
}): { hasMore: boolean; nextOffset: number } {
  const alreadyPaged =
    args.paged &&
    (args.loadedCount > args.incomingCount || args.currentNextOffset > args.incomingNextOffset)
  if (alreadyPaged) {
    return {
      hasMore: args.currentHasMore,
      nextOffset: Math.max(args.currentNextOffset, args.incomingNextOffset),
    }
  }
  return { hasMore: args.incomingHasMore, nextOffset: args.incomingNextOffset }
}

/** Unknown staff id must not empty a server-hydrated Mine queue. */
export function inboxItemPassesMineFilter(
  assigneeAdminId: string | null,
  currentStaffId: string | null,
): boolean {
  return !currentStaffId || assigneeAdminId === currentStaffId
}
