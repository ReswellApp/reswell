"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { format, formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Loader2,
  ShoppingCart,
} from "lucide-react"
import type {
  AdminHiddenListingRow,
  AdminHiddenListingsSummary,
} from "@/lib/db/adminHiddenListings"
import { isCheckoutBlockedHiddenListing } from "@/lib/db/adminHiddenListings"
import type { ListingVisibilityEventRow } from "@/lib/db/listingVisibilityEvents"
import { listingVisibilitySourceLabel } from "@/lib/listing-visibility-sources"
import { listingDetailHref, peerListingCheckoutHref } from "@/lib/listing-href"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { capitalizeWords } from "@/lib/listing-labels"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type FilterMode = "checkout_blocked" | "all"

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

function listingThumb(row: AdminHiddenListingRow): string | null {
  const url = row.listing_images?.[0]?.url?.trim()
  return url || null
}

function checkoutBlockedBadge(row: AdminHiddenListingRow) {
  if (!isCheckoutBlockedHiddenListing(row)) return null
  return (
    <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300">
      Checkout 404
    </Badge>
  )
}

function actorLabel(event: ListingVisibilityEventRow | null | undefined): string {
  if (!event) return "—"
  return (
    event.actor?.display_name?.trim() ||
    event.actor?.email?.trim() ||
    (event.actor_user_id ? event.actor_user_id.slice(0, 8) : "System")
  )
}

function VisibilityCauseCell({
  event,
  onOpenHistory,
}: {
  event: ListingVisibilityEventRow | null
  onOpenHistory: () => void
}) {
  return (
    <div className="min-w-[11rem] space-y-1">
      <p className="text-sm font-medium text-foreground">
        {listingVisibilitySourceLabel(event?.source)}
      </p>
      {event ? (
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
          {" · "}
          {actorLabel(event)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">No audit event yet</p>
      )}
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onOpenHistory}>
        <History className="mr-1 h-3.5 w-3.5" />
        History
      </Button>
    </div>
  )
}

export function AdminHiddenListingsPanel() {
  const [listings, setListings] = useState<AdminHiddenListingRow[]>([])
  const [summary, setSummary] = useState<AdminHiddenListingsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterMode>("checkout_blocked")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [unhideBusy, setUnhideBusy] = useState(false)
  const [historyListing, setHistoryListing] = useState<AdminHiddenListingRow | null>(null)
  const [historyEvents, setHistoryEvents] = useState<ListingVisibilityEventRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const load = useCallback(async (mode: FilterMode) => {
    setLoading(true)
    try {
      const q = mode === "checkout_blocked" ? "?checkout_blocked=1" : ""
      const res = await fetch(`/api/admin/listings/hidden${q}`, { credentials: "include" })
      const json = (await res.json()) as {
        listings?: AdminHiddenListingRow[]
        summary?: AdminHiddenListingsSummary
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Failed to load hidden listings")
        setListings([])
        setSummary(null)
        return
      }
      setListings(json.listings ?? [])
      setSummary(json.summary ?? null)
      setSelectedIds(new Set())
    } catch {
      toast.error("Failed to load hidden listings")
      setListings([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(filter)
  }, [filter, load])

  const visibleIds = useMemo(() => listings.map((l) => l.id), [listings])
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(visibleIds) : new Set())
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function openHistory(listing: AdminHiddenListingRow) {
    setHistoryListing(listing)
    setHistoryEvents([])
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/admin/listings/${listing.id}/visibility-events`, {
        credentials: "include",
      })
      const json = (await res.json()) as {
        events?: ListingVisibilityEventRow[]
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Failed to load history")
        return
      }
      setHistoryEvents(json.events ?? [])
    } catch {
      toast.error("Failed to load history")
    } finally {
      setHistoryLoading(false)
    }
  }

  async function unhideListings(ids: string[]) {
    if (ids.length === 0) return
    setUnhideBusy(true)
    try {
      const res = await fetch("/api/admin/listings/hidden", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_ids: ids }),
      })
      const json = (await res.json()) as {
        unhidden_ids?: string[]
        failed?: { id: string; error: string }[]
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Failed to restore visibility")
        return
      }
      const unhidden = new Set(json.unhidden_ids ?? [])
      setListings((prev) => prev.filter((l) => !unhidden.has(l.id)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of unhidden) next.delete(id)
        return next
      })
      const failed = json.failed ?? []
      if (failed.length > 0) {
        toast.error(`Restored ${unhidden.size}; ${failed.length} failed`)
      } else {
        toast.success(
          unhidden.size === 1 ? "Listing visible on site again" : `${unhidden.size} listings restored`,
        )
      }
      void load(filter)
    } catch {
      toast.error("Failed to restore visibility")
    } finally {
      setUnhideBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
            <Link href="/admin/listings">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              All listings
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Hidden listings</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Listings with <code className="text-xs">hidden_from_site</code> are removed from browse,
            search, and checkout. Sellers on vacation mode use the same flag — but active listings
            stuck hidden will show &ldquo;no longer available&rdquo; publicly and return checkout 404.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checkout_blocked">Checkout blocked (active)</SelectItem>
              <SelectItem value="all">All hidden</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={selectedIds.size === 0 || unhideBusy}
            onClick={() => void unhideListings([...selectedIds])}
          >
            {unhideBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            Restore selected ({selectedIds.size})
          </Button>
        </div>
      </div>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
              Checkout blocked
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.checkoutBlockedActive}</p>
            <p className="mt-1 text-xs text-muted-foreground">Active + hidden + has pickup or shipping</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total hidden</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.totalHidden}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Drafts</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.hiddenDraft}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sold / removed</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {summary.hiddenSold + summary.hiddenRemoved}
            </p>
          </div>
        </div>
      ) : null}

      {filter === "checkout_blocked" && (summary?.checkoutBlockedActive ?? 0) > 0 ? (
        <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              These listings look live in the database but buyers cannot find or purchase them.
            </p>
            <p className="text-muted-foreground">
              Check the &ldquo;How hidden&rdquo; column for the recorded cause (vacation, inactivity,
              admin, etc.). Older listings may say unknown until a new hide/unhide is logged. Use
              Restore to put them back on the site and enable checkout.
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <EyeOff className="h-8 w-8 text-muted-foreground/60" />
            <p className="font-medium text-foreground">No hidden listings in this view</p>
            <p className="text-sm text-muted-foreground">
              {filter === "checkout_blocked"
                ? "No active listings are currently blocking checkout."
                : "Nothing is hidden from the public site."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => toggleSelectAll(v === true)}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Listing</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>How hidden</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((listing) => {
                const thumb = listingThumb(listing)
                const slugOrId = listing.slug?.trim() || listing.id
                const checkoutHref = peerListingCheckoutHref(listing.section, slugOrId)
                const blocked = isCheckoutBlockedHiddenListing(listing)
                return (
                  <TableRow key={listing.id} className={cn(blocked && "bg-amber-500/[0.03]")}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(listing.id)}
                        onCheckedChange={(v) => toggleRow(listing.id, v === true)}
                        aria-label={`Select ${listing.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                          {thumb ? (
                            <Image
                              src={proxiedListingImageSrc(thumb)}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {capitalizeWords(listing.title)}
                          </p>
                          <p className="text-sm tabular-nums text-muted-foreground">
                            {formatUsd(Number(listing.price))} · {listing.section}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {checkoutBlockedBadge(listing)}
                            {listing.local_pickup !== false ? (
                              <Badge variant="outline" className="text-[10px]">
                                Pickup
                              </Badge>
                            ) : null}
                            {listing.shipping_available ? (
                              <Badge variant="outline" className="text-[10px]">
                                Ships
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate text-sm">{listing.profiles?.display_name ?? "—"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {listing.profiles?.email ?? listing.user_id.slice(0, 8)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <VisibilityCauseCell
                        event={listing.latest_visibility_event}
                        onOpenHistory={() => void openHistory(listing)}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{listing.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(listing.updated_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={listingDetailHref(listing)} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1 h-3.5 w-3.5" />
                            PDP
                          </Link>
                        </Button>
                        {blocked ? (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={checkoutHref} target="_blank" rel="noopener noreferrer">
                              <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                              Checkout
                            </Link>
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={unhideBusy}
                          onClick={() => void unhideListings([listing.id])}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Restore
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog
        open={historyListing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setHistoryListing(null)
            setHistoryEvents([])
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Visibility history</DialogTitle>
            <DialogDescription>
              {historyListing
                ? `${capitalizeWords(historyListing.title)} — every hide/unhide we recorded.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : historyEvents.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No visibility events yet for this listing. Events are recorded from now on whenever
              vacation mode, admin hide/restore, inactivity, archive, or status changes flip{" "}
              <code className="text-xs">hidden_from_site</code>.
            </p>
          ) : (
            <ul className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {historyEvents.map((event) => (
                <li key={event.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={event.hidden_from_site ? "secondary" : "outline"}>
                      {event.hidden_from_site ? "Hidden" : "Visible"}
                    </Badge>
                    <span className="font-medium">
                      {listingVisibilitySourceLabel(event.source)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(event.created_at), "MMM d, yyyy · h:mm a")} · {actorLabel(event)}
                  </p>
                  {event.note ? (
                    <p className="mt-1 text-xs text-muted-foreground">{event.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
