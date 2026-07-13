"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { MessageSquare, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  SiteSearchFormSubmitButton,
  SiteSearchShell,
  siteSearchInputClassName,
  siteSearchSubmitButtonClassName,
} from "@/components/site-search-bar"
import { cn } from "@/lib/utils"
import { capitalizeWords } from "@/lib/listing-labels"
import { searchBoardTalkCatalogSuggest } from "@/app/actions/board-talk"
import type { BoardTalkSearchSuggestResult } from "@/lib/services/boardTalkSearch"

const DEBOUNCE_MS = 200
const MIN_QUERY_LENGTH = 1

type BoardTalkSearchProps = {
  defaultValue?: string
  className?: string
  placeholder?: string
  /** Compact styling for embedding inside the Threads sub-nav bar. */
  embedded?: boolean
}

type DropdownItem =
  | { kind: "thread"; index: number; title: string; slug: string }
  | { kind: "comment"; index: number; excerpt: string; threadTitle: string; threadSlug: string; commentId: string }

function flattenResults(results: BoardTalkSearchSuggestResult | null): DropdownItem[] {
  if (!results) return []
  const items: DropdownItem[] = []
  results.threads.forEach((row, index) => {
    items.push({ kind: "thread", index, title: row.title, slug: row.slug })
  })
  results.comments.forEach((row, index) => {
    items.push({
      kind: "comment",
      index,
      excerpt: row.excerpt,
      threadTitle: row.thread_title,
      threadSlug: row.thread_slug,
      commentId: row.id,
    })
  })
  return items
}

/**
 * Threads directory search with typeahead. Shows matching posts and comments in a
 * dropdown; Enter without a highlighted row submits GET `/threads?q=…`.
 */
export function BoardTalkSearch({
  defaultValue = "",
  className,
  placeholder = "Search posts and comments…",
  embedded = false,
}: BoardTalkSearchProps) {
  const router = useRouter()
  const [value, setValue] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)
  const [results, setResults] = React.useState<BoardTalkSearchSuggestResult | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [highlight, setHighlight] = React.useState(0)
  const [dropdownRect, setDropdownRect] = React.useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const generationRef = React.useRef(0)

  const listId = React.useId()
  const q = value.trim()
  const flatItems = React.useMemo(() => flattenResults(results), [results])
  const hasResults = flatItems.length > 0
  const showDropdown = open && q.length >= MIN_QUERY_LENGTH && (loading || hasResults)
  const threadItems = results?.threads ?? []
  const commentItems = results?.comments ?? []

  React.useEffect(() => {
    setValue(defaultValue)
  }, [defaultValue])

  React.useEffect(() => {
    setHighlight(0)
  }, [results])

  const invalidatePending = React.useCallback(() => {
    generationRef.current += 1
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (q.length < MIN_QUERY_LENGTH) {
      invalidatePending()
      setResults(null)
      setLoading(false)
      setOpen(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const gen = ++generationRef.current
      void (async () => {
        if (gen !== generationRef.current) return
        setLoading(true)
        try {
          const next = await searchBoardTalkCatalogSuggest(q)
          if (gen !== generationRef.current) return
          setResults(next)
          const hasAny = next.threads.length > 0 || next.comments.length > 0
          if (!hasAny) {
            setOpen(false)
            return
          }
          const isFocused =
            Boolean(inputRef.current && document.activeElement === inputRef.current)
          setOpen(isFocused)
        } finally {
          if (gen === generationRef.current) setLoading(false)
        }
      })()
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [q, invalidatePending])

  React.useEffect(() => {
    if (!showDropdown || !containerRef.current || typeof document === "undefined") {
      setDropdownRect(null)
      return
    }
    const el = containerRef.current
    const update = () => {
      const rect = el.getBoundingClientRect()
      setDropdownRect({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [showDropdown])

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node
      if (containerRef.current?.contains(t)) return
      if (dropdownRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const goToThread = React.useCallback(
    (slug: string) => {
      if (!slug) return
      invalidatePending()
      setOpen(false)
      router.push(`/threads/${encodeURIComponent(slug)}`)
    },
    [router, invalidatePending],
  )

  const goToComment = React.useCallback(
    (threadSlug: string, commentId: string) => {
      if (!threadSlug || !commentId) return
      invalidatePending()
      setOpen(false)
      router.push(
        `/threads/${encodeURIComponent(threadSlug)}#comment-${encodeURIComponent(commentId)}`,
      )
    },
    [router, invalidatePending],
  )

  const submitDirectorySearch = React.useCallback(
    (term: string) => {
      invalidatePending()
      setOpen(false)
      const t = term.trim()
      if (!t) {
        router.push("/threads")
        return
      }
      router.push(`/threads?q=${encodeURIComponent(t)}`)
    },
    [router, invalidatePending],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const item = flatItems[highlight]
    if (open && item) {
      if (item.kind === "thread") {
        goToThread(item.slug)
        return
      }
      goToComment(item.threadSlug, item.commentId)
      return
    }
    submitDirectorySearch(value)
  }

  function handleSelectItem(item: DropdownItem) {
    if (item.kind === "thread") {
      goToThread(item.slug)
      return
    }
    goToComment(item.threadSlug, item.commentId)
  }

  const panelWidth = dropdownRect
    ? Math.min(Math.max(dropdownRect.width, 320), 560)
    : 420
  const panelLeft = dropdownRect
    ? Math.min(
        dropdownRect.left,
        typeof window !== "undefined" ? window.innerWidth - panelWidth - 16 : dropdownRect.left,
      )
    : 0

  let flatIndex = -1

  const dropdownPanel =
    showDropdown &&
    dropdownRect &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={dropdownRef}
        id={listId}
        role="listbox"
        aria-label="Threads matches"
        className="fixed z-[100] overflow-hidden rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-xl shadow-black/10"
        style={{
          top: dropdownRect.top,
          left: panelLeft,
          width: panelWidth,
          maxHeight: "min(60vh, 480px)",
        }}
      >
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Threads
          </p>
          <p className="text-xs text-muted-foreground">Press Enter to search all results</p>
        </div>

        {loading && !hasResults ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Searching…</div>
        ) : (
          <div className="max-h-[min(50vh,400px)] overflow-y-auto py-1">
            {threadItems.length > 0 ? (
              <div>
                <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Posts
                </p>
                <ul>
                  {threadItems.map((row) => {
                    flatIndex += 1
                    const itemIndex = flatIndex
                    return (
                      <li key={row.id} role="none">
                        <button
                          type="button"
                          role="option"
                          aria-selected={itemIndex === highlight}
                          className={cn(
                            "flex w-full cursor-pointer select-none items-center gap-3 px-4 py-2.5 text-left text-sm outline-none min-h-touch transition-colors hover:bg-muted/80",
                            itemIndex === highlight && "bg-muted/80",
                          )}
                          onMouseEnter={() => setHighlight(itemIndex)}
                          onMouseDown={(ev) => {
                            ev.preventDefault()
                            goToThread(row.slug)
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                            {capitalizeWords(row.title)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}

            {commentItems.length > 0 ? (
              <div className={threadItems.length > 0 ? "border-t border-border/60" : undefined}>
                <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Comments
                </p>
                <ul>
                  {commentItems.map((row) => {
                    flatIndex += 1
                    const itemIndex = flatIndex
                    return (
                      <li key={row.id} role="none">
                        <button
                          type="button"
                          role="option"
                          aria-selected={itemIndex === highlight}
                          className={cn(
                            "flex w-full cursor-pointer select-none items-start gap-3 px-4 py-2.5 text-left text-sm outline-none min-h-touch transition-colors hover:bg-muted/80",
                            itemIndex === highlight && "bg-muted/80",
                          )}
                          onMouseEnter={() => setHighlight(itemIndex)}
                          onMouseDown={(ev) => {
                            ev.preventDefault()
                            goToComment(row.thread_slug, row.id)
                          }}
                        >
                          <MessageSquare
                            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/80"
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-foreground">{row.excerpt}</span>
                            <span className="mt-1 block truncate text-xs text-muted-foreground">
                              in {capitalizeWords(row.thread_title)}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>,
      document.body,
    )

  const showClear = value.length > 0

  return (
    <div className={cn("w-full", className)} ref={containerRef}>
      <form onSubmit={handleSubmit}>
        <SiteSearchShell
          className={cn(
            embedded &&
              "h-9 min-h-0 gap-0.5 rounded-md border-white/20 bg-white/95 py-0 pl-1.5 pr-1 shadow-none focus-within:border-white/40 focus-within:ring-white/20",
          )}
          actionSlot={
            embedded ? (
              <Button
                type="submit"
                size="icon"
                className={cn(siteSearchSubmitButtonClassName(true), "h-8 w-8 shrink-0 rounded-full p-0")}
                aria-label="Search Threads"
              >
                <Search className="h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <SiteSearchFormSubmitButton type="submit" aria-label="Search Threads">
                Search
              </SiteSearchFormSubmitButton>
            )
          }
        >
          <Input
            ref={inputRef}
            type="search"
            name="q"
            enterKeyHint="search"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              if (e.target.value.trim().length >= MIN_QUERY_LENGTH) setOpen(true)
            }}
            onFocus={() => {
              if (hasResults && q.length >= MIN_QUERY_LENGTH) setOpen(true)
            }}
            onKeyDown={(e) => {
              if (!showDropdown || !hasResults) {
                if (e.key === "Escape") setOpen(false)
                return
              }
              if (e.key === "Escape") {
                e.preventDefault()
                setOpen(false)
                return
              }
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setHighlight((h) => Math.min(h + 1, flatItems.length - 1))
                return
              }
              if (e.key === "ArrowUp") {
                e.preventDefault()
                setHighlight((h) => Math.max(h - 1, 0))
                return
              }
              if (e.key === "Enter") {
                const item = flatItems[highlight]
                if (item) {
                  e.preventDefault()
                  handleSelectItem(item)
                }
              }
            }}
            placeholder={placeholder}
            aria-label="Search Threads"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={showDropdown ? listId : undefined}
            autoComplete="off"
            className={cn(
              siteSearchInputClassName({ compact: embedded }),
              embedded && "h-8 min-h-0 pl-2 text-sm",
              showClear && "pr-10",
              showClear &&
                "[&::-webkit-search-cancel-button]:hidden [&::-moz-search-clear]:hidden",
            )}
          />
          {showClear ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                invalidatePending()
                setValue("")
                setResults(null)
                setOpen(false)
                router.push("/threads")
              }}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          {loading && q.length >= MIN_QUERY_LENGTH ? (
            <span
              className={cn(
                "absolute top-1/2 -translate-y-1/2 text-xs text-muted-foreground",
                showClear ? "right-10" : "right-3",
              )}
              aria-hidden
            >
              …
            </span>
          ) : null}
        </SiteSearchShell>
      </form>
      {dropdownPanel}
    </div>
  )
}
