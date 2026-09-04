import Link from "next/link"
import { Bell, Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { BoardSavedSearchListItem } from "@/lib/actions/boardSavedSearch"
import {
  boardSavedSearchCriteriaSummary,
  boardSavedSearchCriteriaToBrowseHref,
} from "@/lib/utils/board-saved-search-browse-url"
import { BOARD_SAVED_SEARCHES_MAX } from "@/lib/validations/boardSavedSearch"

export function BoardFinderSavedList({
  savedSearches,
  savedLoading,
  deletingId,
  onDelete,
}: {
  savedSearches: BoardSavedSearchListItem[]
  savedLoading: boolean
  deletingId: string | null
  onDelete: (id: string) => void
}) {
  return (
    <section aria-labelledby="board-finder-saved-heading">
      <div className="mb-4 flex items-end justify-between gap-2">
        <div>
          <h2
            id="board-finder-saved-heading"
            className="font-headline text-2xl font-bold tracking-tight text-[#001A4A]"
          >
            On the watch
          </h2>
          <p className="mt-1 text-sm text-[#5c6b89]">
            Tap a search to see what’s live now.
          </p>
        </div>
        {!savedLoading ? (
          <span className="text-xs tabular-nums text-[#5574AD]">
            {savedSearches.length}/{BOARD_SAVED_SEARCHES_MAX}
          </span>
        ) : null}
      </div>

      {savedLoading ? (
        <p className="text-sm text-[#5c6b89]">Loading your watches…</p>
      ) : savedSearches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#001A4A]/20 bg-white/70 px-5 py-8 text-center">
          <p className="text-sm text-[#5c6b89]">
            Empty lineup. Save a search above — you can keep {BOARD_SAVED_SEARCHES_MAX} running at
            once.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {savedSearches.map((saved) => {
            const label = saved.label?.trim() || boardSavedSearchCriteriaSummary(saved.criteria)
            const href = boardSavedSearchCriteriaToBrowseHref(saved.criteria)
            return (
              <li key={saved.id}>
                <div className="flex items-stretch overflow-hidden rounded-2xl border border-[#001A4A]/10 bg-white shadow-sm">
                  <Link
                    href={href}
                    className="min-w-0 flex-1 px-4 py-3.5 transition-colors hover:bg-[#F4F7FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5574AD]/30"
                  >
                    <span className="block text-sm font-semibold leading-snug text-[#001A4A]">
                      {label}
                    </span>
                    <span className="mt-1 block text-xs text-[#5c6b89]">
                      {saved.emailNotificationsEnabled ? (
                        <span className="inline-flex items-center gap-1 text-[#5574AD]">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5574AD]/50" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#5574AD]" />
                          </span>
                          <Bell className="h-3 w-3" aria-hidden />
                          Watching
                        </span>
                      ) : (
                        "Open on /boards"
                      )}
                    </span>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="my-2 mr-2 h-9 w-9 shrink-0 rounded-full text-[#5c6b89] hover:text-destructive"
                    aria-label={`Remove saved search: ${label}`}
                    disabled={deletingId === saved.id}
                    onClick={() => onDelete(saved.id)}
                  >
                    {deletingId === saved.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
