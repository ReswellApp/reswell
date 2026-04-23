"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"

/** Fast autosaves stay visually quiet; slow ones surface a spinner after this delay. */
const DRAFT_SAVE_BUSY_REVEAL_MS = 450
/** Plain "Saved" copy — no ticking "5s ago" — keeps the bar calm while editing. */
const DRAFT_SAVED_RECENT_MS = 120_000
/** How often the relative "Saved · …" line refreshes once the draft is older. */
const DRAFT_SAVED_RELATIVE_TICK_MS = 60_000

export interface SellDraftItem {
  id: string
  title: string | null
  price: number | null
  updatedAt: string
  primaryImageUrl: string | null
}

export type DraftSaveStatusKind = "idle" | "saving" | "saved" | "error"

interface DraftsPickerProps {
  drafts: SellDraftItem[]
  /** The draft currently being edited — shown with a check in the list. */
  currentDraftId: string | null
  onSelect: (draftId: string) => void
  onDiscard: (draftId: string) => Promise<void> | void
  /** Optional — renders a pinned "Start a new listing" action at the top of the menu. */
  onStartNew?: () => void
  disabled?: boolean
  className?: string
}

function draftDisplayTitle(draft: SellDraftItem): string {
  const t = draft.title?.trim()
  return t && t.length > 0 ? t : "Untitled draft"
}

function formatDraftPrice(price: number | null): string | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null
  const rounded = Math.round(price)
  return `$${rounded.toLocaleString()}`
}

function formatDraftUpdated(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "just now"
  return `${formatDistanceToNow(d)} ago`
}

/**
 * Dropdown that lists the seller's recent drafts. The popover is the single entry
 * point for draft management on /sell: "Start a new listing" sits at the top,
 * and each row opens or discards a saved draft.
 */
export function DraftsPicker({
  drafts,
  currentDraftId,
  onSelect,
  onDiscard,
  onStartNew,
  disabled,
  className,
}: DraftsPickerProps) {
  const [open, setOpen] = useState(false)
  const [discardingId, setDiscardingId] = useState<string | null>(null)

  const count = drafts.length

  const sortedDrafts = useMemo(() => {
    if (!currentDraftId) return drafts
    const mine = drafts.find((d) => d.id === currentDraftId)
    if (!mine) return drafts
    return [mine, ...drafts.filter((d) => d.id !== currentDraftId)]
  }, [drafts, currentDraftId])

  if (count === 0 && !onStartNew) return null

  async function handleDiscard(id: string) {
    if (discardingId) return
    setDiscardingId(id)
    try {
      await onDiscard(id)
    } finally {
      setDiscardingId(null)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("shrink-0", className)}
        >
          <FileText className="h-4 w-4 mr-2" aria-hidden />
          Drafts
          {count > 0 && (
            <span
              aria-hidden
              className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1.5 text-[11px] font-semibold leading-none text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              {count}
            </span>
          )}
          <ChevronDown className="ml-1.5 h-4 w-4 opacity-70" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-2rem))] p-0 overflow-hidden"
      >
        {onStartNew && (
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onStartNew()
            }}
            className={cn(
              "flex w-full items-center gap-3 px-4 py-3 text-left",
              "border-b border-border",
              "transition-colors hover:bg-muted/70 focus-visible:bg-muted/70",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
              <Plus className="h-4 w-4" aria-hidden />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                Start a new listing
              </span>
              <span className="block text-xs text-muted-foreground">
                Your current draft stays saved
              </span>
            </span>
          </button>
        )}
        {count > 0 ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Your drafts
              </p>
              <span className="text-[11px] font-medium text-muted-foreground">
                {count} saved
              </span>
            </div>
            <ul
              role="listbox"
              aria-label="Saved drafts"
              className="max-h-[22rem] overflow-y-auto divide-y divide-border"
            >
              {sortedDrafts.map((draft) => {
                const isCurrent = draft.id === currentDraftId
                const isDiscarding = discardingId === draft.id
                const title = draftDisplayTitle(draft)
                const price = formatDraftPrice(draft.price)
                const updated = formatDraftUpdated(draft.updatedAt)
                const imgSrc = draft.primaryImageUrl
                  ? proxiedListingImageSrc(draft.primaryImageUrl)
                  : null

                return (
                  <li key={draft.id} className="group">
                    <div
                      className={cn(
                        "flex items-stretch gap-3 px-3 py-2.5 transition-colors",
                        "hover:bg-muted/70 focus-within:bg-muted/70",
                        isCurrent && "bg-muted/50",
                      )}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={isCurrent}
                        onClick={() => {
                          setOpen(false)
                          onSelect(draft.id)
                        }}
                        disabled={isDiscarding}
                        className={cn(
                          "flex flex-1 items-center gap-3 text-left min-w-0",
                          "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isDiscarding && "opacity-60",
                        )}
                      >
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                          {imgSrc ? (
                            <Image
                              src={imgSrc}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <FileText className="h-5 w-5" aria-hidden />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p
                              className={cn(
                                "truncate text-sm font-medium text-foreground",
                                !draft.title && "text-muted-foreground italic",
                              )}
                            >
                              {title}
                            </p>
                            {isCurrent && (
                              <Check
                                className="h-3.5 w-3.5 shrink-0 text-foreground"
                                aria-label="Currently open"
                              />
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            {price && (
                              <>
                                <span className="font-medium text-foreground">
                                  {price}
                                </span>
                                <span aria-hidden className="text-border">
                                  •
                                </span>
                              </>
                            )}
                            <span className="truncate">Edited {updated}</span>
                          </div>
                        </div>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Discard draft ${title}`}
                        disabled={isDiscarding}
                        onClick={() => void handleDiscard(draft.id)}
                        className="h-8 w-8 self-center text-muted-foreground hover:text-destructive"
                      >
                        {isDiscarding ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden />
                        )}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <p className="px-4 py-3 text-xs text-muted-foreground">
            No saved drafts yet — your work here autosaves as you type.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

interface DraftSavedStatusProps {
  status: DraftSaveStatusKind
  savedAt: number | null
  className?: string
}

/**
 * Inline autosave indicator next to the Drafts picker.
 * Fast saves avoid a spinner flash; recent saves use stable "Saved" copy instead of ticking seconds.
 */
export function DraftSavedStatus({
  status,
  savedAt,
  className,
}: DraftSavedStatusProps) {
  const [coarseTick, setCoarseTick] = useState(0)
  const [showSavingUi, setShowSavingUi] = useState(false)

  useEffect(() => {
    if (status !== "saving") {
      setShowSavingUi(false)
      return
    }
    const id = window.setTimeout(() => setShowSavingUi(true), DRAFT_SAVE_BUSY_REVEAL_MS)
    return () => {
      window.clearTimeout(id)
      setShowSavingUi(false)
    }
  }, [status])

  useEffect(() => {
    if (status !== "saved" || savedAt == null) return
    const age = Date.now() - savedAt
    let quietBoundary: ReturnType<typeof setTimeout> | undefined
    if (age < DRAFT_SAVED_RECENT_MS) {
      quietBoundary = window.setTimeout(() => {
        setCoarseTick((t) => t + 1)
      }, DRAFT_SAVED_RECENT_MS - age + 25)
    }
    const id = window.setInterval(() => {
      setCoarseTick((t) => t + 1)
    }, DRAFT_SAVED_RELATIVE_TICK_MS)
    return () => {
      if (quietBoundary != null) window.clearTimeout(quietBoundary)
      window.clearInterval(id)
    }
  }, [status, savedAt])

  const display = useMemo(() => {
    if (status === "error") {
      return { tone: "danger" as const, label: "Save failed", showSpinner: false, showCheck: false }
    }

    const savingVisible = status === "saving" && showSavingUi
    if (savingVisible) {
      return {
        tone: "accent" as const,
        label: "Saving…",
        showSpinner: true,
        showCheck: false,
      }
    }

    if (savedAt == null) return null

    const ageMs = Math.max(0, Date.now() - savedAt)
    const quietRecent = ageMs < DRAFT_SAVED_RECENT_MS

    if (status === "saved" || (status === "saving" && !showSavingUi)) {
      if (quietRecent) {
        return {
          tone: "muted" as const,
          label: "Saved",
          showSpinner: false,
          showCheck: true,
        }
      }
      return {
        tone: "muted" as const,
        label: `Saved · ${formatDistanceToNow(savedAt, { addSuffix: true })}`,
        showSpinner: false,
        showCheck: true,
      }
    }

    return null
  }, [status, savedAt, showSavingUi, coarseTick])

  if (!display) return null

  return (
    <span
      role="status"
      aria-live={display.tone === "danger" ? "polite" : "off"}
      className={cn(
        "hidden sm:inline-flex items-center gap-1.5 text-xs font-normal tabular-nums",
        "text-muted-foreground transition-colors duration-300",
        display.tone === "accent" && "text-foreground",
        display.tone === "danger" && "text-destructive font-medium",
        className,
      )}
    >
      {display.showSpinner && (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-80" aria-hidden />
      )}
      {display.showCheck && (
        <Check className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={2.25} aria-hidden />
      )}
      {display.label}
    </span>
  )
}
