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
 * Small inline indicator communicating autosave state next to the Drafts picker.
 * Ticks the relative label every ~15s while idle so "Saved · 2m ago" stays fresh.
 */
export function DraftSavedStatus({
  status,
  savedAt,
  className,
}: DraftSavedStatusProps) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (status !== "saved" || savedAt == null) return
    const id = window.setInterval(() => setTick((t) => t + 1), 15_000)
    return () => window.clearInterval(id)
  }, [status, savedAt])

  let label: string | null = null
  let tone: "muted" | "accent" | "danger" = "muted"
  if (status === "saving") {
    label = "Saving…"
    tone = "accent"
  } else if (status === "error") {
    label = "Save failed"
    tone = "danger"
  } else if (status === "saved" && savedAt != null) {
    const secondsAgo = Math.max(0, Math.floor((Date.now() - savedAt) / 1000))
    if (secondsAgo < 5) label = "Saved just now"
    else if (secondsAgo < 60) label = `Saved ${secondsAgo}s ago`
    else label = `Saved ${formatDistanceToNow(savedAt)} ago`
    tone = "muted"
  }

  if (!label) return null

  return (
    <span
      aria-live="polite"
      className={cn(
        "hidden sm:inline-flex items-center gap-1.5 text-xs font-medium",
        tone === "accent" && "text-foreground",
        tone === "muted" && "text-muted-foreground",
        tone === "danger" && "text-destructive",
        className,
      )}
    >
      {status === "saving" && (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      )}
      {status === "saved" && (
        <Check className="h-3.5 w-3.5" aria-hidden />
      )}
      {label}
    </span>
  )
}
