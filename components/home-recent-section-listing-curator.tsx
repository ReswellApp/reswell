"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { AdminHomeRecentSectionParam } from "@/lib/validations/home-recent-section-listings"

type CuratedRow = {
  id: string
  listing_id: string
  sort_order: number
  listing: {
    id: string
    slug: string
    title: string
    status: string | null
    hidden_from_site: boolean | null
    hidden_from_homepage: boolean | null
    primary_image_url: string | null
  }
}

type SearchHit = {
  id: string
  slug: string
  title: string
  primary_image_url: string | null
  hidden_from_homepage?: boolean | null
  already_curated: boolean
}

const plusOutlineClass =
  "h-10 w-10 shrink-0 rounded-full border border-border bg-background shadow-sm hover:bg-muted/60"

const SEARCH_DEBOUNCE_MS = 200

type HomeRecentSectionListingCuratorProps = {
  sectionPath: AdminHomeRecentSectionParam
  dialogTitle: string
  dialogDescription: string
  isAdmin: boolean
  buttonLabel: string
  className?: string
}

export function HomeRecentSectionListingCurator({
  sectionPath,
  dialogTitle,
  dialogDescription,
  isAdmin,
  buttonLabel,
  className,
}: HomeRecentSectionListingCuratorProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [curated, setCurated] = React.useState<CuratedRow[]>([])
  const [loadingCurated, setLoadingCurated] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [addingListingId, setAddingListingId] = React.useState<string | null>(null)
  const [reordering, setReordering] = React.useState(false)
  const [homepageToggleId, setHomepageToggleId] = React.useState<string | null>(null)

  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchHits, setSearchHits] = React.useState<SearchHit[]>([])
  const [searching, setSearching] = React.useState(false)

  const base = `/api/admin/home-recent-section-listings/${sectionPath}`

  const loadCurated = React.useCallback(async () => {
    setLoadingCurated(true)
    try {
      const res = await fetch(base, { credentials: "include" })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { rows: CuratedRow[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load listings")
        return
      }
      setCurated(Array.isArray(json.data?.rows) ? json.data!.rows : [])
    } finally {
      setLoadingCurated(false)
    }
  }, [base])

  const runSearch = React.useCallback(
    async (q: string) => {
      setSearching(true)
      try {
        const params = new URLSearchParams()
        if (q.trim()) params.set("q", q.trim())
        params.set("limit", "20")
        const res = await fetch(`${base}/search?${params.toString()}`, { credentials: "include" })
        const json = (await res.json().catch(() => ({}))) as {
          data?: { hits: SearchHit[] }
          error?: string
        }
        if (!res.ok) {
          toast.error(typeof json.error === "string" ? json.error : "Search failed")
          return
        }
        setSearchHits(Array.isArray(json.data?.hits) ? json.data!.hits : [])
      } finally {
        setSearching(false)
      }
    },
    [base],
  )

  React.useEffect(() => {
    if (!dialogOpen) return
    void loadCurated()
    void runSearch("")
  }, [dialogOpen, loadCurated, runSearch])

  React.useEffect(() => {
    if (!dialogOpen) return
    const handle = window.setTimeout(() => {
      void runSearch(searchQuery)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [dialogOpen, searchQuery, runSearch])

  async function persistReorder(next: CuratedRow[]) {
    setReordering(true)
    try {
      const res = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ordered_row_ids: next.map((r) => r.id) }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not reorder")
        await loadCurated()
        return
      }
      setCurated(next)
      toast.success("Order updated")
      router.refresh()
    } finally {
      setReordering(false)
    }
  }

  async function moveRow(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= curated.length) return
    const next = curated.slice()
    const tmp = next[index]!
    next[index] = next[j]!
    next[j] = tmp
    await persistReorder(next)
  }

  async function onToggleHomepageHidden(listingId: string, currentlyHidden: boolean) {
    setHomepageToggleId(listingId)
    try {
      const res = await fetch(`/api/admin/listings/${encodeURIComponent(listingId)}/homepage-visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hidden_from_homepage: !currentlyHidden }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not update visibility")
        return
      }
      toast.success(currentlyHidden ? "Listing visible on homepage again" : "Listing hidden from homepage")
      setCurated((prev) =>
        prev.map((r) =>
          r.listing_id === listingId ? { ...r, listing: { ...r.listing, hidden_from_homepage: !currentlyHidden } } : r,
        ),
      )
      setSearchHits((prev) =>
        prev.map((h) =>
          h.id === listingId ? { ...h, hidden_from_homepage: !currentlyHidden } : h,
        ),
      )
      router.refresh()
    } finally {
      setHomepageToggleId(null)
    }
  }

  async function onAdd(listingId: string) {
    setAddingListingId(listingId)
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ listing_id: listingId }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not add listing")
        return
      }
      toast.success("Listing added to this homepage row")
      setSearchHits((prev) =>
        prev.map((h) => (h.id === listingId ? { ...h, already_curated: true } : h)),
      )
      await loadCurated()
      router.refresh()
    } finally {
      setAddingListingId(null)
    }
  }

  async function onRemove(rowId: string, listingId: string) {
    setDeletingId(rowId)
    try {
      const res = await fetch(`${base}/rows/${encodeURIComponent(rowId)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not remove listing")
        return
      }
      toast.success("Removed from homepage row")
      setCurated((prev) => prev.filter((r) => r.id !== rowId))
      setSearchHits((prev) =>
        prev.map((h) => (h.id === listingId ? { ...h, already_curated: false } : h)),
      )
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  if (!isAdmin) return null

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={cn(plusOutlineClass, className)}
        onClick={() => setDialogOpen(true)}
        aria-label={buttonLabel}
        title={buttonLabel}
      >
        <Plus className="h-5 w-5" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className={cn(
            "grid max-h-[min(90dvh,720px)] w-[min(100%,calc(100vw-1.5rem))] min-w-0 max-w-xl gap-4 overflow-x-hidden overflow-y-auto sm:max-w-xl",
            "p-4 sm:p-6",
          )}
        >
          <DialogHeader className="shrink-0 min-w-0 text-left sm:text-left">
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription className="text-pretty [overflow-wrap:anywhere]">{dialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="flex min-w-0 flex-col gap-6">
            <section className="flex min-w-0 flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">Featured order ({curated.length})</h3>
              {loadingCurated ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : curated.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
                  No picks yet. This homepage row uses the newest matching listings automatically.
                </p>
              ) : (
                <div className="max-h-[min(260px,32vh)] min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain">
                  <ul className="min-w-0 space-y-2 pr-0.5">
                    {curated.map((row, i) => (
                      <ListingPickRow
                        key={row.id}
                        imageUrl={row.listing.primary_image_url}
                        title={row.listing.title}
                        href={`/boards/${row.listing.slug}`}
                        warning={
                          row.listing.status !== "active"
                            ? "Not active — won’t appear on the homepage until active again."
                            : row.listing.hidden_from_site === true
                              ? "Hidden site-wide — won’t appear on the homepage until restored."
                              : row.listing.hidden_from_homepage === true
                                ? "Hidden from homepage — won’t show in feeds on the home screen."
                                : null
                        }
                        extraActions={
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              aria-label={`Move ${row.listing.title} up`}
                              disabled={reordering || i === 0}
                              onClick={() => void moveRow(i, -1)}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              aria-label={`Move ${row.listing.title} down`}
                              disabled={reordering || i >= curated.length - 1}
                              onClick={() => void moveRow(i, 1)}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              title={row.listing.hidden_from_homepage ? "Show on homepage again" : "Hide from homepage"}
                              aria-label={row.listing.hidden_from_homepage ? "Show on homepage again" : "Hide from homepage"}
                              disabled={homepageToggleId === row.listing_id}
                              onClick={() =>
                                void onToggleHomepageHidden(row.listing_id, row.listing.hidden_from_homepage === true)
                              }
                            >
                              {homepageToggleId === row.listing_id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : row.listing.hidden_from_homepage ? (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={deletingId === row.id}
                              onClick={() => void onRemove(row.id, row.listing_id)}
                              aria-label={`Remove ${row.listing.title}`}
                            >
                              {deletingId === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        }
                      />
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="flex min-w-0 flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">Add a listing</h3>
              <div className="relative w-full min-w-0 max-w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search active listings by title…"
                  className="w-full min-w-0 pl-9"
                  aria-label="Search listings"
                />
              </div>
              {searching && searchHits.length === 0 ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : searchHits.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                  {searchQuery.trim()
                    ? "No active listings match that search."
                    : "No active listings yet."}
                </p>
              ) : (
                <div className="max-h-[min(300px,40vh)] min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain">
                  <ul className="min-w-0 space-y-2 pr-0.5">
                    {searchHits.map((hit) => (
                      <ListingPickRow
                        key={hit.id}
                        imageUrl={hit.primary_image_url}
                        title={hit.title}
                        href={`/boards/${hit.slug}`}
                        warning={
                          hit.hidden_from_homepage === true
                            ? "Hidden from homepage — add if you mean to restore it afterward."
                            : null
                        }
                        extraActions={
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              disabled={homepageToggleId === hit.id || hit.already_curated}
                              title={hit.hidden_from_homepage ? "Show on homepage" : "Hide from homepage"}
                              aria-label={
                                hit.hidden_from_homepage ? "Show on homepage search results" : "Hide from homepage"
                              }
                              onClick={() =>
                                void onToggleHomepageHidden(hit.id, hit.hidden_from_homepage === true)
                              }
                            >
                              {homepageToggleId === hit.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : hit.hidden_from_homepage ? (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                            {hit.already_curated ? (
                              <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                Added
                              </span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={Boolean(addingListingId)}
                                onClick={() => void onAdd(hit.id)}
                                className="shrink-0"
                              >
                                {addingListingId === hit.id ? (
                                  <>
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    Adding…
                                  </>
                                ) : (
                                  <>
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    Add
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        }
                      />
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ListingPickRow({
  imageUrl,
  title,
  href,
  warning,
  extraActions,
}: {
  imageUrl: string | null
  title: string
  href: string
  warning: string | null
  extraActions: React.ReactNode
}) {
  return (
    <li className="flex w-full min-w-0 max-w-full items-center gap-2 rounded-lg border border-border/80 bg-muted/20 p-2 sm:gap-3">
      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
            unoptimized={imageUrl.startsWith("/")}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
            No image
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <Link
          href={href}
          target="_blank"
          rel="noreferrer"
          className="group flex min-w-0 max-w-full items-start gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80"
          title={title}
        >
          <span className="line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere]">{title}</span>
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground/80" />
        </Link>
        {warning ? (
          <p className="mt-0.5 break-words text-[11px] text-amber-700 [overflow-wrap:anywhere] dark:text-amber-400">
            {warning}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">{extraActions}</div>
    </li>
  )
}
