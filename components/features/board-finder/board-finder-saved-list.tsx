import Link from "next/link"
import { Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { BoardSavedSearchListItem } from "@/lib/actions/boardSavedSearch"
import { cn } from "@/lib/utils"
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
  className,
}: {
  savedSearches: BoardSavedSearchListItem[]
  savedLoading: boolean
  deletingId: string | null
  onDelete: (id: string) => void
  className?: string
}) {
  return (
    <section
      aria-labelledby="board-finder-saved-heading"
      className={cn(
        "rounded-[1.75rem] border border-[#e3eaef] bg-white px-5 py-6 sm:px-8 sm:py-8",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="board-finder-saved-heading"
          className="font-headline text-2xl font-semibold tracking-tight text-[#13233f]"
        >
          Saved searches
        </h2>
        {!savedLoading ? (
          <span className="text-xs tabular-nums text-[#7d8c9b]">
            {savedSearches.length} of {BOARD_SAVED_SEARCHES_MAX}
          </span>
        ) : null}
      </div>

      {savedLoading ? (
        <p className="mt-6 text-sm text-[#7d8c9b]">Loading your searches…</p>
      ) : savedSearches.length === 0 ? (
        <p className="mt-6 max-w-sm text-sm leading-relaxed text-[#5c6d80]">
          Nothing saved yet. You can keep up to {BOARD_SAVED_SEARCHES_MAX}.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {savedSearches.map((saved) => {
            const label = saved.label?.trim() || boardSavedSearchCriteriaSummary(saved.criteria)
            const href = boardSavedSearchCriteriaToBrowseHref(saved.criteria)
            return (
              <li
                key={saved.id}
                className="flex items-center gap-3 rounded-2xl bg-[#f4f7fa] px-4 py-3"
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    saved.emailNotificationsEnabled ? "bg-[#3d6b86]" : "bg-[#c5d0da]",
                  )}
                  aria-hidden
                />
                <Link
                  href={href}
                  className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355185]/30"
                >
                  <span className="block truncate text-sm font-medium text-[#13233f]">{label}</span>
                  <span className="mt-0.5 block text-xs text-[#7d8c9b]">
                    {saved.emailNotificationsEnabled ? "Email on" : "No email"}
                  </span>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full text-[#7d8c9b] hover:bg-white hover:text-destructive"
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
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
