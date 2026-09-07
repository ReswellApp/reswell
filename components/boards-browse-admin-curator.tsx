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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { boardsBrowseBoardTypeLabel } from "@/lib/marketplace-slug-metadata"
import { listingDetailHref } from "@/lib/listing-href"
import { cn } from "@/lib/utils"

type AdminListingRow = {
  id: string
  slug: string
  title: string
  price: number | null
  board_type: string | null
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
    price: number | null
    board_type: string | null
    status: string | null
    hidden_from_site: boolean | null
    primary_image_url: string | null
  }
}

type TopPickFilter = "all" | "live" | "stale"
type CmsTab = "top-picks" | "suppressed" | "inventory"

const plusOutlineClass =
  "h-10 w-10 shrink-0 rounded-full border border-border bg-background shadow-sm hover:bg-muted/60"

const SEARCH_DEBOUNCE_MS = 200
const INVENTORY_PAGE_SIZE = 50
const SUPPRESSED_API = "/api/admin/boards-browse-suppressed-listings"
const TOP_PICKS_API = "/api/admin/boards-browse-top-picks"

const priceFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

function formatListingPrice(price: number | null | undefined): string | null {
  if (typeof price !== "number" || !Number.isFinite(price)) return null
  return priceFmt.format(price)
}

function isLiveOnBoards(listing: {
  status: string | null
  hidden_from_site: boolean | null
}): boolean {
  return listing.status === "active" && listing.hidden_from_site !== true
}

function listingMetaLine(opts: {
  price?: number | null
  boardType?: string | null
  rank?: number
}): string {
  const parts: string[] = []
  if (typeof opts.rank === "number") parts.push(`#${opts.rank}`)
  const price = formatListingPrice(opts.price)
  if (price) parts.push(price)
  const typeLabel = boardsBrowseBoardTypeLabel(opts.boardType ?? undefined)
  if (typeLabel) parts.push(typeLabel)
  return parts.join(" · ")
}

type BoardsBrowseAdminCuratorProps = {
  isAdmin: boolean
  className?: string
}

/**
 * Admin CMS for /boards: pin listings to the top, suppress to sort last, or hide site-wide.
 */
export function BoardsBrowseAdminCurator({ isAdmin, className }: BoardsBrowseAdminCuratorProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<CmsTab>("top-picks")
  const [topPicks, setTopPicks] = React.useState<TopPickRow[]>([])
  const [loadingTopPicks, setLoadingTopPicks] = React.useState(false)
  const [addingTopPickId, setAddingTopPickId] = React.useState<string | null>(null)
  const [deletingTopPickRowId, setDeletingTopPickRowId] = React.useState<string | null>(null)
  const [reorderingTopPicks, setReorderingTopPicks] = React.useState(false)
  const [cleaningStale, setCleaningStale] = React.useState(false)
  const [topPickFilter, setTopPickFilter] = React.useState<TopPickFilter>("all")
  const [topPickQuery, setTopPickQuery] = React.useState("")
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
  const [hideAlreadyCurated, setHideAlreadyCurated] = React.useState(true)

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

  const topPickListingIds = React.useMemo(
    () => new Set(topPicks.map((row) => row.listing_id)),
    [topPicks],
  )

  const staleTopPicks = React.useMemo(
    () => topPicks.filter((row) => !isLiveOnBoards(row.listing)),
    [topPicks],
  )
  const liveTopPicks = React.useMemo(
    () => topPicks.filter((row) => isLiveOnBoards(row.listing)),
    [topPicks],
  )

  const filteredTopPicks = React.useMemo(() => {
    const q = topPickQuery.trim().toLowerCase()
    return topPicks.filter((row) => {
      if (topPickFilter === "live" && !isLiveOnBoards(row.listing)) return false
      if (topPickFilter === "stale" && isLiveOnBoards(row.listing)) return false
      if (!q) return true
      return row.listing.title.toLowerCase().includes(q)
    })
  }, [topPicks, topPickFilter, topPickQuery])

  const visibleInventory = React.useMemo(() => {
    if (!hideAlreadyCurated) return searchHits
    return searchHits.filter((hit) => !topPickListingIds.has(hit.id))
  }, [hideAlreadyCurated, searchHits, topPickListingIds])

  const hasMoreInventory = searchHits.length < inventoryTotal

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

  async function moveTopPickRow(indexInFullList: number, dir: -1 | 1) {
    const j = indexInFullList + dir
    if (j < 0 || j >= topPicks.length) return
    const next = topPicks.slice()
    const tmp = next[indexInFullList]!
    next[indexInFullList] = next[j]!
    next[j] = tmp
    await persistTopPickReorder(next)
  }

  async function sendTopPickRowToTop(indexInFullList: number) {
    if (indexInFullList <= 0) return
    const next = topPicks.slice()
    const [item] = next.splice(indexInFullList, 1)
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
      toast.success("Pinned to top of /boards")
      await loadTopPicks()
      setActiveTab("top-picks")
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

  async function onCleanupStaleTopPicks() {
    if (staleTopPicks.length === 0) return
    setCleaningStale(true)
    try {
      const res = await fetch(`${TOP_PICKS_API}/cleanup-stale`, {
        method: "POST",
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { removed?: number }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not clean up stale Top Picks")
        return
      }
      const removed = typeof json.data?.removed === "number" ? json.data.removed : 0
      toast.success(
        removed > 0
          ? `Removed ${removed} inactive Top Pick${removed === 1 ? "" : "s"}`
          : "No inactive Top Picks to remove",
      )
      await loadTopPicks()
      setTopPickFilter("all")
      router.refresh()
    } finally {
      setCleaningStale(false)
    }
  }

  function patchLocalListing(listingId: string, patch: Partial<AdminListingRow>) {
    setSuppressed((prev) =>
      prev
        .map((r) => (r.id === listingId ? { ...r, ...patch } : r))
        .filter((r) => (patch.suppressed_on_boards_browse === false ? r.id !== listingId : true)),
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
      await loadTopPicks()
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
        variant={suppressedFlag ? "outline" : "ghost"}
        size={suppressedFlag ? "sm" : "icon"}
        className={suppressedFlag ? "h-9 gap-1.5 px-2.5 text-xs" : "h-9 w-9"}
        title={suppressedFlag ? "Restore normal sort" : "Show last on /boards"}
        aria-label={suppressedFlag ? "Restore normal sort" : "Show last on /boards"}
        disabled={suppressToggleId === listingId || disabled}
        onClick={() => void onToggleSuppressed(listingId, suppressedFlag)}
      >
        {suppressToggleId === listingId ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <ArrowDownToLine
              className={cn("h-4 w-4", suppressedFlag ? "text-amber-600" : "text-muted-foreground")}
            />
            {suppressedFlag ? <span>Restore</span> : null}
          </>
        )}
      </Button>
    )
  }

  function topPickButton(listingId: string, isTopPick: boolean, disabled?: boolean) {
    return (
      <Button
        type="button"
        variant={isTopPick ? "ghost" : "outline"}
        size={isTopPick ? "icon" : "sm"}
        className={isTopPick ? "h-9 w-9" : "h-9 gap-1.5 px-2.5 text-xs"}
        title={isTopPick ? "Already pinned to top" : "Pin to top of /boards"}
        aria-label={isTopPick ? "Already pinned to top" : "Pin to top of /boards"}
        disabled={addingTopPickId === listingId || isTopPick || disabled}
        onClick={() => void onAddTopPick(listingId)}
      >
        {addingTopPickId === listingId ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Star
              className={cn(
                "h-4 w-4",
                isTopPick ? "fill-amber-500 text-amber-500" : "text-amber-600",
              )}
            />
            {!isTopPick ? <span>Pin</span> : null}
          </>
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
            "flex h-[min(92dvh,860px)] w-[min(100%,calc(100vw-1.5rem))] min-w-0 max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl",
          )}
        >
          <DialogHeader className="shrink-0 space-y-1.5 border-b border-border/70 px-4 py-4 text-left sm:px-6 sm:text-left">
            <DialogTitle>/boards CMS</DialogTitle>
            <DialogDescription className="text-pretty [overflow-wrap:anywhere]">
              Pin listings to the top of /boards at all times. Everything else shuffles every 24
              hours — boards listed during the current window still appear next, without
              reshuffling the rest. Suppress to the bottom, or hide from the site entirely.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as CmsTab)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="shrink-0 border-b border-border/70 px-4 pt-3 sm:px-6">
              <TabsList className="mb-3 grid h-auto w-full grid-cols-3 gap-1 p-1">
                <TabsTrigger value="top-picks" className="gap-1.5 text-xs sm:text-sm">
                  Top Picks
                  <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px] tabular-nums">
                    {topPicks.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="inventory" className="text-xs sm:text-sm">
                  Inventory
                </TabsTrigger>
                <TabsTrigger value="suppressed" className="gap-1.5 text-xs sm:text-sm">
                  Suppressed
                  <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px] tabular-nums">
                    {suppressed.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
              <TabsContent value="top-picks" className="mt-0 space-y-3 outline-none">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: "all", label: "All", count: topPicks.length },
                        { id: "live", label: "Live", count: liveTopPicks.length },
                        { id: "stale", label: "Inactive", count: staleTopPicks.length },
                      ] as const
                    ).map((opt) => (
                      <Button
                        key={opt.id}
                        type="button"
                        size="sm"
                        variant={topPickFilter === opt.id ? "default" : "outline"}
                        className="h-8 gap-1.5 px-2.5 text-xs"
                        onClick={() => setTopPickFilter(opt.id)}
                      >
                        {opt.label}
                        <span className="tabular-nums opacity-80">{opt.count}</span>
                      </Button>
                    ))}
                  </div>
                  {staleTopPicks.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 border-amber-300 text-xs text-amber-800 hover:bg-amber-50"
                      disabled={cleaningStale || loadingTopPicks}
                      onClick={() => void onCleanupStaleTopPicks()}
                    >
                      {cleaningStale ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Remove {staleTopPicks.length} inactive
                    </Button>
                  ) : null}
                </div>

                {staleTopPicks.length > 0 && topPickFilter !== "stale" ? (
                  <p className="rounded-md border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {staleTopPicks.length} Top Pick
                    {staleTopPicks.length === 1 ? " is" : "s are"} sold, draft, or hidden and will
                    not appear on /boards until cleaned up.
                  </p>
                ) : null}

                <div className="relative w-full min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={topPickQuery}
                    onChange={(e) => setTopPickQuery(e.target.value)}
                    placeholder="Filter Top Picks by title…"
                    className="w-full min-w-0 pl-9"
                    aria-label="Filter Top Picks"
                  />
                </div>

                {loadingTopPicks ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : topPicks.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                    No Top Picks yet. Open Inventory and pin boards to the top of /boards.
                  </p>
                ) : filteredTopPicks.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                    No Top Picks match this filter.
                  </p>
                ) : (
                  <ul className="min-w-0 space-y-2">
                    {filteredTopPicks.map((row) => {
                      const fullIndex = topPicks.findIndex((r) => r.id === row.id)
                      const live = isLiveOnBoards(row.listing)
                      const meta = listingMetaLine({
                        rank: fullIndex >= 0 ? fullIndex + 1 : undefined,
                        price: row.listing.price,
                        boardType: row.listing.board_type,
                      })
                      return (
                        <ListingPickRow
                          key={row.id}
                          imageUrl={row.listing.primary_image_url}
                          title={row.listing.title}
                          href={listingDetailHref({
                            slug: row.listing.slug,
                            id: row.listing.id,
                          })}
                          meta={meta || null}
                          warning={
                            !live
                              ? row.listing.status !== "active"
                                ? "Not active — won't appear on /boards."
                                : "Hidden from site."
                              : null
                          }
                          muted={!live}
                          extraActions={
                            <div className="flex shrink-0 items-center gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                title="Send to #1"
                                aria-label="Send to #1"
                                disabled={reorderingTopPicks || fullIndex <= 0}
                                onClick={() => void sendTopPickRowToTop(fullIndex)}
                              >
                                <ChevronsUp className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                disabled={reorderingTopPicks || fullIndex <= 0}
                                aria-label="Move up"
                                title="Move up"
                                onClick={() => void moveTopPickRow(fullIndex, -1)}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                disabled={
                                  reorderingTopPicks ||
                                  fullIndex < 0 ||
                                  fullIndex >= topPicks.length - 1
                                }
                                aria-label="Move down"
                                title="Move down"
                                onClick={() => void moveTopPickRow(fullIndex, 1)}
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
                          }
                        />
                      )
                    })}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="suppressed" className="mt-0 space-y-3 outline-none">
                <p className="text-xs text-muted-foreground">
                  Suppressed boards stay visible but sort to the bottom of /boards.
                </p>
                {loadingSuppressed ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : suppressed.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                    No suppressed listings. From Inventory, use the down-arrow to push a board to the
                    end of /boards.
                  </p>
                ) : (
                  <ul className="min-w-0 space-y-2">
                    {suppressed.map((row) => (
                      <ListingPickRow
                        key={row.id}
                        imageUrl={row.primary_image_url}
                        title={row.title}
                        href={listingDetailHref({ slug: row.slug, id: row.id })}
                        meta={listingMetaLine({
                          price: row.price,
                          boardType: row.board_type,
                        })}
                        warning={
                          row.status !== "active"
                            ? "Not active — won't appear on /boards."
                            : row.hidden_from_site === true
                              ? "Hidden from site."
                              : null
                        }
                        muted={!isLiveOnBoards(row)}
                        extraActions={
                          <div className="flex shrink-0 items-center gap-0.5">
                            {suppressButton(row.id, true)}
                            {siteHideButton(row.id, row.hidden_from_site === true)}
                          </div>
                        }
                      />
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="inventory" className="mt-0 space-y-3 outline-none">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <p className="text-xs text-muted-foreground">
                    Active surfboards, newest first. Pin to the top of /boards, suppress to the
                    bottom, or hide from the site.
                  </p>
                  {searchHits.length > 0 && inventoryTotal > searchHits.length ? (
                    <span className="text-xs text-muted-foreground">
                      Showing {searchHits.length.toLocaleString()} of{" "}
                      {inventoryTotal.toLocaleString()}
                    </span>
                  ) : null}
                </div>

                <div className="relative w-full min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search inventory by title…"
                    className="w-full min-w-0 pl-9"
                    aria-label="Search active surfboards"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-border"
                    checked={hideAlreadyCurated}
                    onChange={(e) => setHideAlreadyCurated(e.target.checked)}
                  />
                  Hide boards already pinned
                </label>

                {searching && searchHits.length === 0 ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : visibleInventory.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                    {searchQuery.trim()
                      ? "No active surfboards match that search."
                      : hideAlreadyCurated && searchHits.length > 0
                        ? "All loaded inventory boards are already pinned."
                        : "No active surfboards in inventory."}
                  </p>
                ) : (
                  <ul className="min-w-0 space-y-2">
                    {visibleInventory.map((hit) => {
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
                          meta={listingMetaLine({
                            price: hit.price,
                            boardType: hit.board_type,
                          })}
                          warning={
                            inactive
                              ? "Not active."
                              : hidden
                                ? "Hidden from site."
                                : isTopPick
                                  ? "Already pinned to top of /boards."
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
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ListingPickRow({
  imageUrl,
  title,
  href,
  meta,
  warning,
  muted,
  extraActions,
}: {
  imageUrl: string | null
  title: string
  href: string
  meta?: string | null
  warning: string | null
  muted?: boolean
  extraActions: React.ReactNode
}) {
  return (
    <li
      className={cn(
        "flex w-full min-w-0 max-w-full items-center gap-2 rounded-lg border border-border/80 bg-muted/20 p-2 sm:gap-3",
        muted && "opacity-75",
      )}
    >
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
        {meta ? (
          <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{meta}</p>
        ) : null}
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
