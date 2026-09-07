import Link from "next/link"
import { Loader2, Trash2 } from "lucide-react"

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
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2
          id="board-finder-saved-heading"
          className="font-headline text-xl font-semibold tracking-tight text-[#001A4A]"
        >
          Saved searches
        </h2>
        {!savedLoading ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {savedSearches.length}/{BOARD_SAVED_SEARCHES_MAX}
          </span>
        ) : null}
      </div>

      {savedLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : savedSearches.length === 0 ? (
        <p className="text-sm text-muted-foreground">None yet.</p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {savedSearches.map((saved) => {
            const label = saved.label?.trim() || boardSavedSearchCriteriaSummary(saved.criteria)
            const href = boardSavedSearchCriteriaToBrowseHref(saved.criteria)
            return (
              <li key={saved.id} className="flex items-center gap-2 py-3">
                <Link
                  href={href}
                  className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5574AD]/30"
                >
                  <span className="block text-sm font-medium text-[#001A4A]">{label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {saved.emailNotificationsEnabled ? "Email alerts on" : "No email"}
                  </span>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
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
