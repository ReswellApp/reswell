"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, Loader2, Plus, Search, Trash2 } from "lucide-react"
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

/** GET /api/admin/home-hero-listings returns these rows (joined listing metadata). */
type CuratedHeroRow = {
  id: string
  listing_id: string
  sort_order: number
  listing: {
    id: string
    slug: string
    title: string
    status: string | null
    hidden_from_site: boolean | null
    primary_image_url: string | null
  }
}

type SearchHit = {
  id: string
  slug: string
  title: string
  primary_image_url: string | null
  already_curated: boolean
}

const plusButtonClass =
  "h-10 w-10 shrink-0 rounded-full border-2 border-white/90 bg-foreground text-background shadow-md ring-2 ring-black/5 hover:bg-foreground/90"

const SEARCH_DEBOUNCE_MS = 200

/**
 * Admin-only CMS control for the homepage hero carousel. Restores the "+" affordance in the
 * top-right of the hero and opens a dialog where admins pick which active listings should
 * appear. The homepage reads `home_hero_listings` in server-render and falls back to most-
 * recent active listings when empty. Pass `isAdmin` from the server page (same session as RSC).
 */
export function HomeHeroSlideshowAdminBar({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const [curated, setCurated] = React.useState<CuratedHeroRow[]>([])
  const [loadingCurated, setLoadingCurated] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [addingListingId, setAddingListingId] = React.useState<string | null>(null)

  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchHits, setSearchHits] = React.useState<SearchHit[]>([])
  const [searching, setSearching] = React.useState(false)

  const loadCurated = React.useCallback(async () => {
    setLoadingCurated(true)
    try {
      const res = await fetch("/api/admin/home-hero-listings", { credentials: "include" })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { rows: CuratedHeroRow[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load featured listings")
        return
      }
      setCurated(Array.isArray(json.data?.rows) ? json.data!.rows : [])
    } finally {
      setLoadingCurated(false)
    }
  }, [])

  const runSearch = React.useCallback(async (q: string) => {
    setSearching(true)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set("q", q.trim())
      params.set("limit", "20")
      const res = await fetch(`/api/admin/home-hero-listings/search?${params.toString()}`, {
        credentials: "include",
      })
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
  }, [])

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

  async function onAdd(listingId: string) {
    setAddingListingId(listingId)
    try {
      const res = await fetch("/api/admin/home-hero-listings", {
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
      toast.success("Listing added to hero")
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
      const res = await fetch(`/api/admin/home-hero-listings/${encodeURIComponent(rowId)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not remove listing")
        return
      }
      toast.success("Listing removed from hero")
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
        variant="default"
        className={plusButtonClass}
        onClick={() => setDialogOpen(true)}
        aria-label="Edit homepage hero listings"
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
            <DialogTitle>Homepage hero listings</DialogTitle>
            <DialogDescription className="text-pretty [overflow-wrap:anywhere]">
              Pick which active listings appear in the homepage hero carousel. While there is at
              least one pick, the hero uses <strong>only</strong> those listings&rsquo; primary
              images. Remove every pick to fall back to the 5 most-recently added listings.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-w-0 flex-col gap-6">
            <section className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Featured ({curated.length})
                </h3>
              </div>
              {loadingCurated ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : curated.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                  No picks yet. The hero is using the 5 most-recent active listings.
                </p>
              ) : (
                <div className="max-h-[min(220px,30vh)] min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain">
                  <ul className="min-w-0 space-y-2 pr-0.5">
                    {curated.map((row) => (
                      <HeroListingRow
                        key={row.id}
                        imageUrl={row.listing.primary_image_url}
                        title={row.listing.title}
                        href={`/boards/${row.listing.slug}`}
                        warning={
                          row.listing.status !== "active"
                            ? "Listing is not active — hidden from hero until reactivated."
                            : row.listing.hidden_from_site === true
                              ? "Listing is hidden from the site — hidden from hero until unhidden."
                              : null
                        }
                        action={
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={deletingId === row.id}
                            onClick={() => void onRemove(row.id, row.listing_id)}
                            aria-label={`Remove ${row.listing.title} from hero`}
                          >
                            {deletingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
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
                      <HeroListingRow
                        key={hit.id}
                        imageUrl={hit.primary_image_url}
                        title={hit.title}
                        href={`/boards/${hit.slug}`}
                        warning={null}
                        action={
                          hit.already_curated ? (
                            <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Featured
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={addingListingId === hit.id}
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
                          )
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

function HeroListingRow({
  imageUrl,
  title,
  href,
  warning,
  action,
}: {
  imageUrl: string | null
  title: string
  href: string
  warning: string | null
  action: React.ReactNode
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
      <div className="shrink-0 self-center">{action}</div>
    </li>
  )
}
