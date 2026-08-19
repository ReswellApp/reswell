"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDownToLine,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
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

type CmsTab = "suppressed" | "inventory"

const plusOutlineClass =
  "h-10 w-10 shrink-0 rounded-full border border-border bg-background shadow-sm hover:bg-muted/60"

const SEARCH_DEBOUNCE_MS = 200
const INVENTORY_PAGE_SIZE = 50
const SUPPRESSED_API = "/api/admin/boards-browse-suppressed-listings"

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
 * Admin CMS for /boards: suppress listings to sort last, or hide site-wide.
 */
export function BoardsBrowseAdminCurator({ isAdmin, className }: BoardsBrowseAdminCuratorProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<CmsTab>("inventory")
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
    void loadSuppressed()
    void runSearch("")
  }, [dialogOpen, loadSuppressed, runSearch])

  React.useEffect(() => {
    if (!dialogOpen) return
    const handle = window.setTimeout(() => {
      void runSearch(searchQuery, 0, false)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [dialogOpen, searchQuery, runSearch])

  const hasMoreInventory = searchHits.length < inventoryTotal

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
              Suppress boards to the bottom of /boards, or hide listings from the site entirely.
              Unfiltered /boards shuffles automatically every 24 hours. Boards listed during the
              current window appear at the top without reshuffling the rest.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as CmsTab)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="shrink-0 border-b border-border/70 px-4 pt-3 sm:px-6">
              <TabsList className="mb-3 grid h-auto w-full grid-cols-2 gap-1 p-1">
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
                    Active surfboards, newest first. Suppress to the bottom of /boards or hide from the site.
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

                {searching && searchHits.length === 0 ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : searchHits.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                    {searchQuery.trim()
                      ? "No active surfboards match that search."
                      : "No active surfboards in inventory."}
                  </p>
                ) : (
                  <ul className="min-w-0 space-y-2">
                    {searchHits.map((hit) => {
                      const hidden = hit.hidden_from_site === true
                      const inactive = hit.status !== "active"
                      const isSuppressed = hit.suppressed_on_boards_browse === true
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
                                : isSuppressed
                                  ? "Suppressed — sorts last on /boards."
                                  : null
                          }
                          extraActions={
                            <div className="flex shrink-0 items-center gap-0.5">
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
