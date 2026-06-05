"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDownToLine,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
  Star,
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
import { listingDetailHref } from "@/lib/listing-href"

type AdminListingRow = {
  id: string
  slug: string
  title: string
  status: string | null
  hidden_from_site: boolean | null
  suppressed_on_boards_browse: boolean | null
  primary_image_url: string | null
}

type TopPickRow = {
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

const plusOutlineClass =
  "h-10 w-10 shrink-0 rounded-full border border-border bg-background shadow-sm hover:bg-muted/60"

const SEARCH_DEBOUNCE_MS = 200
const INVENTORY_PAGE_SIZE = 50
const SUPPRESSED_API = "/api/admin/boards-browse-suppressed-listings"
const TOP_PICKS_API = "/api/admin/boards-browse-top-picks"

type BoardsBrowseAdminCuratorProps = {
  isAdmin: boolean
  className?: string
}

/**
 * Admin CMS for /boards: suppress listings so they sort last, or hide them site-wide.
 */
export function BoardsBrowseAdminCurator({ isAdmin, className }: BoardsBrowseAdminCuratorProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [topPicks, setTopPicks] = React.useState<TopPickRow[]>([])
  const [loadingTopPicks, setLoadingTopPicks] = React.useState(false)
  const [addingTopPickId, setAddingTopPickId] = React.useState<string | null>(null)
  const [deletingTopPickRowId, setDeletingTopPickRowId] = React.useState<string | null>(null)
  const [reorderingTopPicks, setReorderingTopPicks] = React.useState(false)
  const [suppressed, setSuppressed] = React.useState<AdminListingRow[]>([])
  const [loadingSuppressed, setLoadingSuppressed] = React.useState(false)
  const [siteToggleId, setSiteToggleId] = React.useState<string | null>(null)
  const [suppressToggleId, setSuppressToggleId] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchHits, setSearchHits] = React.useState<AdminListingRow[]>([])
  const [inventoryTotal, setInventoryTotal] = React.useState(0)
  const [inventoryOffset, setInventoryOffset] = React.useState(0)
  const [searching, setSearching] = React.useState(false)
  const [loadingMoreInventory, setLoadingMoreInventory] = React.useState(false)

  const loadTopPicks = React.useCallback(async () => {
    setLoadingTopPicks(true)
    try {
      const res = await fetch(TOP_PICKS_API, { credentials: "include" })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { rows: TopPickRow[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load Top Picks")
        return
      }
      setTopPicks(Array.isArray(json.data?.rows) ? json.data!.rows : [])
    } finally {
      setLoadingTopPicks(false)
    }
  }, [])

  const loadSuppressed = React.useCallback(async () => {
    setLoadingSuppressed(true)
    try {
      const res = await fetch(SUPPRESSED_API, { credentials: "include" })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { rows: AdminListingRow[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load suppressed listings")
        return
      }
      setSuppressed(Array.isArray(json.data?.rows) ? json.data!.rows : [])
    } finally {
      setLoadingSuppressed(false)
    }
  }, [])

  const runSearch = React.useCallback(async (q: string, offset = 0, append = false) => {
    if (append) setLoadingMoreInventory(true)
    else setSearching(true)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set("q", q.trim())
      params.set("limit", String(INVENTORY_PAGE_SIZE))
      params.set("offset", String(offset))
      const res = await fetch(`${SUPPRESSED_API}/search?${params.toString()}`, {
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { hits: AdminListingRow[]; total?: number }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load inventory")
        return
      }
      const hits = Array.isArray(json.data?.hits) ? json.data!.hits : []
      const total = typeof json.data?.total === "number" ? json.data.total : hits.length
      setInventoryTotal(total)
      setInventoryOffset(offset + hits.length)
      setSearchHits((prev) => (append ? [...prev, ...hits] : hits))
    } finally {
      if (append) setLoadingMoreInventory(false)
      else setSearching(false)
    }
  }, [])

  React.useEffect(() => {
    if (!dialogOpen) return
    void loadTopPicks()
    void loadSuppressed()
    void runSearch("")
  }, [dialogOpen, loadTopPicks, loadSuppressed, runSearch])

  React.useEffect(() => {
    if (!dialogOpen) return
    const handle = window.setTimeout(() => {
      void runSearch(searchQuery, 0, false)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [dialogOpen, searchQuery, runSearch])

  const hasMoreInventory = searchHits.length < inventoryTotal

  const topPickListingIds = React.useMemo(
    () => new Set(topPicks.map((row) => row.listing_id)),
    [topPicks],
  )

  async function persistTopPickReorder(next: TopPickRow[]) {
    setReorderingTopPicks(true)
    try {
      const res = await fetch(TOP_PICKS_API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ordered_row_ids: next.map((r) => r.id) }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not reorder Top Picks")
        await loadTopPicks()
        return
      }
      setTopPicks(next)
      toast.success("Top Picks order updated")
      router.refresh()
    } finally {
      setReorderingTopPicks(false)
    }
  }

  async function moveTopPickRow(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= topPicks.length) return
    const next = topPicks.slice()
    const tmp = next[index]!
    next[index] = next[j]!
    next[j] = tmp
    await persistTopPickReorder(next)
  }

  async function sendTopPickRowToTop(index: number) {
    if (index <= 0) return
    const next = topPicks.slice()
    const [item] = next.splice(index, 1)
    if (!item) return
    next.unshift(item)
    await persistTopPickReorder(next)
  }

  async function onAddTopPick(listingId: string) {
    setAddingTopPickId(listingId)
    try {
      const res = await fetch(TOP_PICKS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ listing_id: listingId }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not add Top Pick")
        return
      }
      toast.success("Added to Top Picks")
      await loadTopPicks()
      router.refresh()
    } finally {
      setAddingTopPickId(null)
    }
  }

  async function onRemoveTopPick(rowId: string) {
    setDeletingTopPickRowId(rowId)
    try {
      const res = await fetch(`${TOP_PICKS_API}/rows/${encodeURIComponent(rowId)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not remove Top Pick")
        return
      }
      toast.success("Removed from Top Picks")
      setTopPicks((prev) => prev.filter((r) => r.id !== rowId))
      router.refresh()
    } finally {
      setDeletingTopPickRowId(null)
    }
  }

  function patchLocalListing(listingId: string, patch: Partial<AdminListingRow>) {
    setSuppressed((prev) =>
      prev
        .map((r) => (r.id === listingId ? { ...r, ...patch } : r))
        .filter((r) => patch.suppressed_on_boards_browse === false ? r.id !== listingId : true),
    )
    setSearchHits((prev) => prev.map((h) => (h.id === listingId ? { ...h, ...patch } : h)))
  }

  async function onToggleSiteHidden(listingId: string, currentlyHidden: boolean) {
    setSiteToggleId(listingId)
    try {
      const res = await fetch(`/api/admin/listings/${encodeURIComponent(listingId)}/site-visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hidden_from_site: !currentlyHidden }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not update visibility")
        return
      }
      toast.success(
        currentlyHidden ? "Listing visible on site again" : "Listing hidden from site and /boards",
      )
      patchLocalListing(listingId, { hidden_from_site: !currentlyHidden })
      router.refresh()
    } finally {
      setSiteToggleId(null)
    }
  }

  async function onToggleSuppressed(listingId: string, currentlySuppressed: boolean) {
    setSuppressToggleId(listingId)
    try {
      const res = await fetch(
        `/api/admin/listings/${encodeURIComponent(listingId)}/boards-browse-suppression`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ suppressed_on_boards_browse: !currentlySuppressed }),
        },
      )
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not update suppression")
        return
      }
      toast.success(
        currentlySuppressed
          ? "Listing restored to normal /boards sort"
          : "Listing will show last on /boards",
      )
      patchLocalListing(listingId, { suppressed_on_boards_browse: !currentlySuppressed })
      if (!currentlySuppressed) {
        await loadSuppressed()
      }
      router.refresh()
    } finally {
      setSuppressToggleId(null)
    }
  }

  function siteHideButton(listingId: string, hidden: boolean, disabled?: boolean) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        title={hidden ? "Show on site again" : "Hide from site"}
        aria-label={hidden ? "Show on site again" : "Hide from site"}
        disabled={siteToggleId === listingId || disabled}
        onClick={() => void onToggleSiteHidden(listingId, hidden)}
      >
        {siteToggleId === listingId ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : hidden ? (
          <Eye className="h-4 w-4 text-muted-foreground" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    )
  }

  function suppressButton(listingId: string, suppressedFlag: boolean, disabled?: boolean) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        title={suppressedFlag ? "Restore normal sort" : "Show last on /boards"}
        aria-label={suppressedFlag ? "Restore normal sort" : "Show last on /boards"}
        disabled={suppressToggleId === listingId || disabled}
        onClick={() => void onToggleSuppressed(listingId, suppressedFlag)}
      >
        {suppressToggleId === listingId ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <ArrowDownToLine
            className={cn("h-4 w-4", suppressedFlag ? "text-amber-600" : "text-muted-foreground")}
          />
        )}
      </Button>
    )
  }

  function topPickButton(listingId: string, isTopPick: boolean, disabled?: boolean) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        title={isTopPick ? "Already a Top Pick" : "Add to Top Picks"}
        aria-label={isTopPick ? "Already a Top Pick" : "Add to Top Picks"}
        disabled={addingTopPickId === listingId || isTopPick || disabled}
        onClick={() => void onAddTopPick(listingId)}
      >
        {addingTopPickId === listingId ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Star
            className={cn("h-4 w-4", isTopPick ? "fill-amber-500 text-amber-500" : "text-muted-foreground")}
          />
        )}
      </Button>
    )
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
        aria-label="Manage /boards listings"
        title="Manage /boards listings"
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
            <DialogTitle>/boards CMS</DialogTitle>
            <DialogDescription className="text-pretty [overflow-wrap:anywhere]">
              Curate Top Picks to pin the best listings at the top of /boards (default sort). Suppress
              listings to push them to the end (they stay visible). Hide from site removes them
              entirely.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-w-0 flex-col gap-6">
            <section className="flex min-w-0 flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Top Picks — show first ({topPicks.length})
              </h3>
              {loadingTopPicks ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : topPicks.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
                  No Top Picks yet. Search below and use the star to pin listings at the top of /boards
                  (all surfboard pages, filtered by board type when applicable).
                </p>
              ) : (
                <div className="max-h-[min(220px,28vh)] min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain">
                  <ul className="min-w-0 space-y-2 pr-0.5">
                    {topPicks.map((row, i) => (
                      <li
                        key={row.id}
                        className="flex w-full min-w-0 max-w-full items-center gap-2 rounded-lg border border-border/80 bg-muted/20 p-2 sm:gap-3"
                      >
                        <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                          {row.listing.primary_image_url ? (
                            <Image
                              src={row.listing.primary_image_url}
                              alt=""
                              fill
                              sizes="80px"
                              className="object-cover"
                              unoptimized={row.listing.primary_image_url.startsWith("/")}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <Link
                            href={listingDetailHref({ slug: row.listing.slug, id: row.listing.id })}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex min-w-0 max-w-full items-start gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80"
                            title={row.listing.title}
                          >
                            <span className="line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere]">
                              {row.listing.title}
                            </span>
                            <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground/80" />
                          </Link>
                          {row.listing.status !== "active" || row.listing.hidden_from_site === true ? (
                            <p className="mt-0.5 break-words text-[11px] text-amber-700 [overflow-wrap:anywhere] dark:text-amber-400">
                              {row.listing.status !== "active"
                                ? "Not active — won't appear on /boards."
                                : "Hidden from site."}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            title="Send to top"
                            aria-label="Send to top"
                            disabled={reorderingTopPicks || i <= 0}
                            onClick={() => void sendTopPickRowToTop(i)}
                          >
                            <ChevronsUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            disabled={reorderingTopPicks || i <= 0}
                            aria-label="Move up"
                            onClick={() => void moveTopPickRow(i, -1)}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            disabled={reorderingTopPicks || i >= topPicks.length - 1}
                            aria-label="Move down"
                            onClick={() => void moveTopPickRow(i, 1)}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            title="Remove from Top Picks"
                            aria-label="Remove from Top Picks"
                            disabled={deletingTopPickRowId === row.id}
                            onClick={() => void onRemoveTopPick(row.id)}
                          >
                            {deletingTopPickRowId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="flex min-w-0 flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Suppressed — show last ({suppressed.length})
              </h3>
              {loadingSuppressed ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : suppressed.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
                  No suppressed listings. Search below and use the down-arrow to push a board to the
                  end of /boards.
                </p>
              ) : (
                <div className="max-h-[min(220px,28vh)] min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain">
                  <ul className="min-w-0 space-y-2 pr-0.5">
                    {suppressed.map((row) => (
                      <ListingPickRow
                        key={row.id}
                        imageUrl={row.primary_image_url}
                        title={row.title}
                        href={listingDetailHref({ slug: row.slug, id: row.id })}
                        warning={
                          row.status !== "active"
                            ? "Not active — won't appear on /boards."
                            : row.hidden_from_site === true
                              ? "Hidden from site."
                              : null
                        }
                        extraActions={
                          <div className="flex shrink-0 items-center gap-0.5">
                            {suppressButton(row.id, true)}
                            {siteHideButton(row.id, row.hidden_from_site === true)}
                          </div>
                        }
                      />
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Active inventory
                  {inventoryTotal > 0 ? ` (${inventoryTotal.toLocaleString()})` : ""}
                </h3>
                {searchHits.length > 0 && inventoryTotal > searchHits.length ? (
                  <span className="text-xs text-muted-foreground">
                    Showing {searchHits.length.toLocaleString()} of {inventoryTotal.toLocaleString()}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                All active surfboards in inventory, newest first. Search by title to narrow the list.
              </p>
              <div className="relative w-full min-w-0 max-w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title…"
                  className="w-full min-w-0 pl-9"
                  aria-label="Search active surfboards"
                />
              </div>
              {searching && searchHits.length === 0 ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : searchHits.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                  {searchQuery.trim()
                    ? "No active surfboards match that search."
                    : "No active surfboards in inventory."}
                </p>
              ) : (
                <div className="max-h-[min(300px,40vh)] min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain">
                  <ul className="min-w-0 space-y-2 pr-0.5">
                    {searchHits.map((hit) => {
                      const hidden = hit.hidden_from_site === true
                      const inactive = hit.status !== "active"
                      const isSuppressed = hit.suppressed_on_boards_browse === true
                      const isTopPick = topPickListingIds.has(hit.id)
                      return (
                        <ListingPickRow
                          key={hit.id}
                          imageUrl={hit.primary_image_url}
                          title={hit.title}
                          href={listingDetailHref({ slug: hit.slug, id: hit.id })}
                          warning={
                            inactive
                              ? "Not active."
                              : hidden
                                ? "Hidden from site."
                                : isTopPick
                                  ? "Top Pick — shows first on /boards."
                                  : isSuppressed
                                    ? "Suppressed — sorts last on /boards."
                                    : null
                          }
                          extraActions={
                            <div className="flex shrink-0 items-center gap-0.5">
                              {topPickButton(hit.id, isTopPick, inactive || hidden)}
                              {suppressButton(hit.id, isSuppressed, inactive || hidden)}
                              {siteHideButton(hit.id, hidden, inactive)}
                            </div>
                          }
                        />
                      )
                    })}
                  </ul>
                </div>
              )}
              {hasMoreInventory ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loadingMoreInventory || searching}
                  onClick={() => void runSearch(searchQuery, inventoryOffset, true)}
                >
                  {loadingMoreInventory ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    `Load more (${(inventoryTotal - searchHits.length).toLocaleString()} remaining)`
                  )}
                </Button>
              ) : null}
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
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
        {extraActions}
      </div>
    </li>
  )
}
