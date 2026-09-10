export function firstNonEmptyText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = value?.replace(/\s+/g, " ").trim()
    if (text) return text
  }
  return ""
}

type InboxListItem = { key: string }

/** Keep the open conversation even when a reply moves it out of the current view. */
export function pinSelectedInboxItem<T extends InboxListItem>(
  filtered: T[],
  selected: T | null,
): T[] {
  if (!selected) return filtered
  if (filtered.some((item) => item.key === selected.key)) return filtered
  return [selected, ...filtered]
}

export function nextInboxSelectedKey(args: {
  items: InboxListItem[]
  filtered: InboxListItem[]
  selectedKey: string | null
  loading: boolean
}): string | null | undefined {
  if (args.loading) return undefined
  if (args.selectedKey && args.items.some((item) => item.key === args.selectedKey)) {
    return undefined
  }
  if (args.filtered.length > 0) return args.filtered[0]!.key
  return args.selectedKey ? null : undefined
}
