"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { MANAGED_PAGE_GROUPS } from "@/lib/seo/managed-pages"
import type { ManagedPageSeoItem } from "@/lib/seo/types"

interface SeoPageListProps {
  items: ManagedPageSeoItem[]
  query: string
  onQueryChange: (value: string) => void
  selectedKey: string | null
  onSelect: (key: string) => void
  dirtyKeys: Set<string>
}

export function SeoPageList({
  items,
  query,
  onQueryChange,
  selectedKey,
  onSelect,
  dirtyKeys,
}: SeoPageListProps) {
  const q = query.trim().toLowerCase()
  const filtered = q
    ? items.filter(
        (it) =>
          it.label.toLowerCase().includes(q) ||
          it.key.toLowerCase().includes(q) ||
          it.defaults.path.toLowerCase().includes(q),
      )
    : items

  return (
    <div className="flex h-full flex-col">
      <div className="relative p-3">
        <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search pages…"
          className="pl-9"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {MANAGED_PAGE_GROUPS.map((group) => {
          const groupItems = filtered.filter((it) => it.group === group.id)
          if (groupItems.length === 0) return null
          return (
            <div key={group.id} className="mb-3">
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {groupItems.map((it) => {
                  const active = it.key === selectedKey
                  const dirty = dirtyKeys.has(it.key)
                  const noindex = it.override.robotsIndex === false
                  return (
                    <li key={it.key}>
                      <button
                        type="button"
                        onClick={() => onSelect(it.key)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60",
                          it.variationOf && "pl-5",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            noindex
                              ? "bg-destructive"
                              : it.customized
                                ? "bg-primary"
                                : "bg-border",
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">{it.label}</span>
                        {dirty ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-label="Unsaved changes" />
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No pages match “{query}”.</p>
        ) : null}
      </div>
    </div>
  )
}
