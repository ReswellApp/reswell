"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Tag } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  listingAdminBarCanSearchTag,
  type ListingAdminBarSnapshot,
} from "@/lib/listing-detail-admin-bar"
import {
  isListingSearchTagSlug,
  LISTING_SEARCH_TAG_MAX,
  LISTING_SEARCH_TAG_PRESETS,
  listingSearchTagLabel,
  normalizeListingSearchTag,
} from "@/lib/listing-search-tags"
import { cn } from "@/lib/utils"

export function ListingDetailAdminSearchTags({
  listing,
  actionClass,
}: {
  listing: ListingAdminBarSnapshot
  actionClass: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [tags, setTags] = React.useState(listing.searchTags)
  const [draft, setDraft] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    setTags(listing.searchTags)
  }, [listing.searchTags])

  if (!listingAdminBarCanSearchTag(listing.section)) return null

  async function save(next: string[]) {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/listings/${encodeURIComponent(listing.id)}/search-tags`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search_tags: next }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: unknown
        data?: { search_tags?: string[] }
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not update search tags")
        return
      }
      const saved = Array.isArray(json.data?.search_tags) ? json.data.search_tags : next
      setTags(saved)
      toast.success(saved.length ? "Search tags updated" : "Search tags cleared")
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  function toggle(slug: string) {
    const next = tags.includes(slug) ? tags.filter((t) => t !== slug) : [...tags, slug]
    void save(next)
  }

  function addDraft() {
    const slug = normalizeListingSearchTag(draft)
    if (!isListingSearchTagSlug(slug)) {
      toast.error("Use a short keyword like fish")
      return
    }
    if (tags.includes(slug)) {
      setDraft("")
      return
    }
    if (tags.length >= LISTING_SEARCH_TAG_MAX) {
      toast.error(`Up to ${LISTING_SEARCH_TAG_MAX} tags`)
      return
    }
    setDraft("")
    void save([...tags, slug])
  }

  const fishOn = tags.includes("fish")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={cn(actionClass, fishOn && "border-sky-400 bg-sky-100 dark:bg-sky-900")}
          aria-label="Search tags"
        >
          <Tag />
          Tag
          {tags.length > 0 ? (
            <span className="ml-0.5 rounded-full bg-sky-200 px-1.5 text-[10px] font-semibold text-sky-900 dark:bg-sky-800 dark:text-sky-50">
              {tags.includes("fish") ? "Fish" : tags.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 p-3">
        <div>
          <p className="text-sm font-medium">Search tags</p>
          <p className="text-xs text-muted-foreground">
            Attach a keyword so this listing matches that search. Fish also includes it on
            /boards?type=fish.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LISTING_SEARCH_TAG_PRESETS.map((preset) => {
            const on = tags.includes(preset.value)
            return (
              <button
                key={preset.value}
                type="button"
                disabled={busy}
                onClick={() => toggle(preset.value)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                  preset.value === "fish" && "ring-1 ring-sky-300 dark:ring-sky-700",
                  on
                    ? "border-sky-600 bg-sky-600 text-white"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        {tags.some((t) => !LISTING_SEARCH_TAG_PRESETS.some((p) => p.value === t)) ? (
          <div className="flex flex-wrap gap-1.5">
            {tags
              .filter((t) => !LISTING_SEARCH_TAG_PRESETS.some((p) => p.value === t))
              .map((tag) => (
                <button
                  key={tag}
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(tag)}
                  className="rounded-full border border-sky-600 bg-sky-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  {listingSearchTagLabel(tag)} ×
                </button>
              ))}
          </div>
        ) : null}
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            addDraft()
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add another keyword"
            className="h-8 text-xs"
            disabled={busy}
            maxLength={32}
          />
          <Button type="submit" size="sm" className="h-8" disabled={busy || !draft.trim()}>
            Add
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
