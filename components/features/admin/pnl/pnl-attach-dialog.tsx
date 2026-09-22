"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { Archive, Loader2, Package, Store, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/pnl-calc"
import type { PnlEntryRow, ReswellListingAvailability, ReswellListingOption } from "@/lib/db/pnl"
import {
  attachHaydenShopActiveAndSoldAction,
  attachReswellListingAction,
  loadReswellTransactionsAction,
} from "@/lib/actions/pnlAdmin"

interface PnlAttachDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAttached: (rows: PnlEntryRow[]) => void
}

type AttachFilter = "all" | ReswellListingAvailability

interface AttachRow {
  key: string
  id: string
  status: ReswellListingAvailability
  board_name: string
  thumbnail_url: string | null
  date: string
  sub: string
}

const STATUS_META: Record<
  ReswellListingAvailability,
  { label: string; className: string; Icon: typeof Tag }
> = {
  active: {
    label: "Active",
    className: "bg-violet-100 text-violet-800 hover:bg-violet-100",
    Icon: Store,
  },
  sold: {
    label: "Sold",
    className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    Icon: Tag,
  },
  removed: {
    label: "Ended",
    className: "bg-neutral-100 text-neutral-700 hover:bg-neutral-100",
    Icon: Archive,
  },
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function listingToRow(listing: ReswellListingOption): AttachRow {
  const sold = listing.status === "sold"
  const when = sold && listing.sale_date ? listing.sale_date : listing.created_at
  const price = sold ? (listing.sale_price ?? listing.price) : listing.price
  return {
    key: `listing-${listing.listing_id}`,
    id: listing.listing_id,
    status: listing.status,
    board_name: listing.board_name,
    thumbnail_url: listing.thumbnail_url,
    date: when,
    sub:
      listing.status === "sold"
        ? `Sold for ${formatCurrency(price)} · ${dateLabel(when)}${listing.order_num ? ` · #${listing.order_num}` : ""}`
        : listing.status === "removed"
          ? `Ended · listed at ${formatCurrency(listing.price)} · ${dateLabel(listing.created_at)}`
          : `Listed at ${formatCurrency(listing.price)} · ${dateLabel(listing.created_at)}`,
  }
}

export function PnlAttachDialog({ open, onOpenChange, onAttached }: PnlAttachDialogProps) {
  const [listings, setListings] = useState<ReswellListingOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<AttachFilter>("all")
  const [attachingKey, setAttachingKey] = useState<string | null>(null)
  const [attachingAll, setAttachingAll] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setError(null)
    loadReswellTransactionsAction()
      .then((res) => {
        if (!active) return
        if ("error" in res) {
          setError(res.error)
          setListings([])
        } else {
          setListings(res.data.listings)
        }
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [open])

  const rows = useMemo(
    () => listings.map(listingToRow).sort((a, b) => b.date.localeCompare(a.date)),
    [listings],
  )

  const visible = rows.filter((row) => filter === "all" || row.status === filter)

  async function handleAttach(row: AttachRow) {
    setAttachingKey(row.key)
    const result = await attachReswellListingAction({ listingId: row.id })
    setAttachingKey(null)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setListings((prev) => prev.filter((l) => l.listing_id !== row.id))
    onAttached([result.data])
    toast.success(`Attached "${result.data.board_name}"`)
  }

  const attachableCount = listings.filter((l) => l.status === "active" || l.status === "sold").length

  async function handleAttachAllActiveAndSold() {
    if (attachableCount === 0) return
    setAttachingAll(true)
    const result = await attachHaydenShopActiveAndSoldAction()
    setAttachingAll(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    const attachedIds = new Set(result.data.map((row) => row.listing_id).filter((id): id is string => Boolean(id)))
    setListings((prev) => prev.filter((l) => !attachedIds.has(l.listing_id)))
    onAttached(result.data)
    toast.success(
      result.data.length === 0
        ? "All active and sold listings were already attached"
        : `Attached ${result.data.length} listing${result.data.length === 1 ? "" : "s"}`,
    )
  }

  const tabs: { key: AttachFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active inventory" },
    { key: "sold", label: "Sold" },
    { key: "removed", label: "Ended" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attach from Reswell</DialogTitle>
          <DialogDescription>
            Pull in Hayden&apos;s shop surfboards and fins — live, sold, or ended. Title, date, and
            price fill in automatically — already-attached boards are hidden.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Button
                key={tab.key}
                variant={filter === tab.key ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            disabled={loading || attachingAll || attachingKey != null || attachableCount === 0}
            onClick={() => void handleAttachAllActiveAndSold()}
          >
            {attachingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Attach all active & sold
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Hayden&apos;s shop surfboards and fins…
            </div>
          ) : error ? (
            <div className="p-12 text-center text-sm text-rose-600">{error}</div>
          ) : visible.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No unattached Hayden&apos;s shop surfboards or fins found here.
            </div>
          ) : (
            <ul className="divide-y">
              {visible.map((row) => {
                const meta = STATUS_META[row.status]
                const { Icon } = meta
                return (
                  <li key={row.key} className="flex items-center gap-3 p-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      {row.thumbnail_url ? (
                        <Image
                          src={row.thumbnail_url}
                          alt={row.board_name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <Package className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{row.board_name}</span>
                        <Badge
                          variant="secondary"
                          className={cn("shrink-0 gap-1 font-normal", meta.className)}
                        >
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{row.sub}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={attachingKey != null || attachingAll}
                      onClick={() => void handleAttach(row)}
                    >
                      {attachingKey === row.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Attach"
                      )}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
