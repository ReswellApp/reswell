"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { SUPPORT_CASE_KIND_LABEL } from "@/lib/utils/support-case-display"
import type {
  SupportReplyExampleAdminView,
  SupportReplyExampleListResult,
  SupportReplyRootPromptView,
} from "@/lib/types/supportReplyDraft"
import { SupportReplyRootPromptEditor } from "./support-reply-root-prompt-editor"
import { SupportReplyLiveChatPromptEditor } from "./support-reply-live-chat-prompt-editor"
import {
  clampSupportReplyExamplesPage,
  supportReplyExamplesHref,
} from "@/lib/utils/support-reply-examples"
import {
  SUPPORT_REPLY_DRAFT_RATINGS,
  SUPPORT_REPLY_EXAMPLE_KINDS,
  SUPPORT_REPLY_EXAMPLE_SEARCH_MAX,
  type SupportReplyDraftRating,
  type SupportReplyExampleKind,
} from "@/lib/validations/supportReplyDraft"
import {
  SupportReplyExampleCard,
  type SupportReplyExampleChange,
} from "./support-reply-example-card"
import { supportReplyExampleRatingLabel } from "./support-reply-example-rating"

const SELECT_CLASS = "h-10 rounded-md border border-input bg-background px-3 text-sm"

interface SupportReplyExamplesAdminClientProps {
  result: SupportReplyExampleListResult
  rootPrompt: SupportReplyRootPromptView
  liveChatPrompt: SupportReplyRootPromptView
  filters: {
    rating?: SupportReplyDraftRating
    kind?: SupportReplyExampleKind
    q?: string
  }
  error?: string
}

export function SupportReplyExamplesAdminClient({
  result,
  rootPrompt,
  liveChatPrompt,
  filters,
  error,
}: SupportReplyExamplesAdminClientProps) {
  const router = useRouter()
  const [query, setQuery] = useState(filters.q ?? "")
  const pageCount = Math.max(1, Math.ceil(result.total / result.limit))

  useEffect(() => {
    setQuery(filters.q ?? "")
  }, [filters.q])

  function go(next: {
    rating?: SupportReplyDraftRating | null
    kind?: SupportReplyExampleKind | null
    q?: string | null
    page?: number
  }) {
    router.push(
      supportReplyExamplesHref({
        rating: next.rating === null ? undefined : (next.rating ?? filters.rating),
        kind: next.kind === null ? undefined : (next.kind ?? filters.kind),
        q: next.q === null ? undefined : (next.q ?? filters.q),
        page: next.page,
      }),
    )
  }

  function afterChange(change: SupportReplyExampleChange) {
    const leftFilter = Boolean(
      change.deleted ||
        (filters.rating && change.rating && change.rating !== filters.rating) ||
        (filters.kind && change.kind !== undefined && (change.kind ?? "") !== filters.kind),
    )
    const nextTotal = leftFilter ? Math.max(0, result.total - 1) : result.total
    const nextPage = clampSupportReplyExamplesPage(result.page, nextTotal, result.limit)
    if (nextPage !== result.page) {
      go({ page: nextPage })
      return
    }
    router.refresh()
  }

  const ratingChips: Array<{ id: SupportReplyDraftRating | undefined; label: string; count: number }> =
    [
      { id: undefined, label: "All", count: result.counts.all },
      ...SUPPORT_REPLY_DRAFT_RATINGS.map((rating) => ({
        id: rating,
        label: supportReplyExampleRatingLabel(rating),
        count: result.counts[rating],
      })),
    ]

  return (
    <div className="space-y-4">
      <SupportReplyRootPromptEditor initial={rootPrompt} />
      <SupportReplyLiveChatPromptEditor initial={liveChatPrompt} />
      <p className="text-sm text-muted-foreground">
        Bad replies are ignored. Okay and Very good both teach later drafts; Very good ranks first.
        Editing a reply before send is Okay — the edited text is what it learns. Rate live chat team
        replies on{" "}
        <Link href="/admin/live-chat" className="font-medium underline-offset-4 hover:underline">
          Live chat
        </Link>
        .{" "}
        <Link href="/admin/contact-messages" className="font-medium underline-offset-4 hover:underline">
          Support tickets
        </Link>
      </p>

      <div className="flex flex-wrap gap-1.5">
        {ratingChips.map((chip) => {
          const selected = filters.rating === chip.id
          return (
            <button
              key={chip.label}
              type="button"
              aria-pressed={selected}
              onClick={() => go({ rating: chip.id ?? null, q: query.trim() || null, page: 1 })}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                selected ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {chip.label} {chip.count}
            </button>
          )
        })}
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          go({ q: query, page: 1 })
        }}
      >
        <select
          className={SELECT_CLASS}
          value={filters.kind ?? ""}
          onChange={(event) =>
            go({
              kind: (event.target.value || null) as SupportReplyExampleKind | null,
              q: query.trim() || null,
              page: 1,
            })
          }
        >
          <option value="">All kinds</option>
          {SUPPORT_REPLY_EXAMPLE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {SUPPORT_CASE_KIND_LABEL[kind]}
            </option>
          ))}
        </select>
        <Input
          value={query}
          maxLength={SUPPORT_REPLY_EXAMPLE_SEARCH_MAX}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search customer or staff copy…"
          className="sm:max-w-sm"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result.items.length === 0 ? (
        <p className="rounded-lg border bg-card px-3 py-8 text-sm text-muted-foreground">
          {result.counts.all === 0 && !filters.q && !filters.rating && !filters.kind
            ? "No examples yet. Send a reply or rate a draft — those land here so later drafts can learn."
            : "Nothing matches these filters."}
        </p>
      ) : (
        <div className="space-y-3">
          {result.items.map((example: SupportReplyExampleAdminView) => (
            <SupportReplyExampleCard key={example.id} example={example} onChanged={afterChange} />
          ))}
        </div>
      )}

      {result.total > result.limit || result.page > 1 ? (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>
            Page {result.page} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={result.page <= 1}
              onClick={() => go({ page: result.page - 1 })}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={result.page >= pageCount}
              onClick={() => go({ page: result.page + 1 })}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
