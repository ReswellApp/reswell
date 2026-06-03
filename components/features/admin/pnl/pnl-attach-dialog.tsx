"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { Loader2, Package, ShoppingCart, Store, Tag } from "lucide-react"
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
import type { PnlEntryRow, ReswellListingOption, ReswellOrderOption } from "@/lib/db/pnl"
import {
  attachReswellListingAction,
  attachReswellOrderAction,
  loadReswellTransactionsAction,
} from "@/lib/actions/pnlAdmin"

interface PnlAttachDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAttached: (row: PnlEntryRow) => void
}

type AttachKind = "sale" | "purchase" | "inventory"
type AttachFilter = "all" | AttachKind

interface AttachRow {
  key: string
  kind: AttachKind
  id: string
  board_name: string
  thumbnail_url: string | null
  price: number
  date: string
  sub: string
  refunded: boolean
}

const KIND_META: Record<AttachKind, { label: string; className: string; Icon: typeof Tag }> = {
  sale: { label: "Sold", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100", Icon: Tag },
  purchase: {
    label: "Bought",
    className: "bg-sky-100 text-sky-800 hover:bg-sky-100",
    Icon: ShoppingCart,
  },
  inventory: {
    label: "Active",
    className: "bg-violet-100 text-violet-800 hover:bg-violet-100",
    Icon: Store,
  },
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function orderToRow(order: ReswellOrderOption): AttachRow {
  return {
    key: `order-${order.order_id}`,
    kind: order.role === "seller" ? "sale" : "purchase",
    id: order.order_id,
    board_name: order.board_name,
    thumbnail_url: order.thumbnail_url,
    price: order.item_price,
    date: order.order_date,
    sub: `${formatCurrency(order.item_price)} · ${dateLabel(order.order_date)}${order.order_num ? ` · #${order.order_num}` : ""}`,
    refunded: order.refunded,
  }
}

function listingToRow(listing: ReswellListingOption): AttachRow {
  return {
    key: `listing-${listing.listing_id}`,
    kind: "inventory",
    id: listing.listing_id,
    board_name: listing.board_name,
    thumbnail_url: listing.thumbnail_url,
    price: listing.price,
    date: listing.created_at,
    sub: `Listed at ${formatCurrency(listing.price)} · ${dateLabel(listing.created_at)}`,
    refunded: false,
  }
}

export function PnlAttachDialog({ open, onOpenChange, onAttached }: PnlAttachDialogProps) {
  const [orders, setOrders] = useState<ReswellOrderOption[]>([])
  const [listings, setListings] = useState<ReswellListingOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<AttachFilter>("all")
  const [attachingKey, setAttachingKey] = useState<string | null>(null)

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
          setOrders([])
          setListings([])
        } else {
          setOrders(res.data.orders)
          setListings(res.data.listings)
        }
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [open])

  const rows = useMemo(
    () => [...orders.map(orderToRow), ...listings.map(listingToRow)].sort((a, b) => b.date.localeCompare(a.date)),
    [orders, listings],
  )

  const visible = rows.filter((r) => filter === "all" || r.kind === filter)

  async function handleAttach(row: AttachRow) {
    setAttachingKey(row.key)
    const result =
      row.kind === "inventory"
        ? await attachReswellListingAction({ listingId: row.id })
        : await attachReswellOrderAction({ orderId: row.id })
    setAttachingKey(null)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    if (row.kind === "inventory") {
      setListings((prev) => prev.filter((l) => l.listing_id !== row.id))
    } else {
      setOrders((prev) => prev.filter((o) => o.order_id !== row.id))
    }
    onAttached(result.data)
    toast.success(`Attached "${result.data.board_name}"`)
  }

  const tabs: { key: AttachFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "sale", label: "Sold" },
    { key: "purchase", label: "Bought" },
    { key: "inventory", label: "Active inventory" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attach from Reswell</DialogTitle>
          <DialogDescription>
            Pull in boards you&apos;ve sold, bought, or have actively listed on Reswell. Prices, fees,
            and dates are filled in automatically — already-attached boards are hidden.
          </DialogDescription>
        </DialogHeader>

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

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your Reswell boards…
            </div>
          ) : error ? (
            <div className="p-12 text-center text-sm text-rose-600">{error}</div>
          ) : visible.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No unattached Reswell boards found here.
            </div>
          ) : (
            <ul className="divide-y">
              {visible.map((row) => {
                const meta = KIND_META[row.kind]
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
                        {row.refunded && (
                          <Badge variant="outline" className="shrink-0 font-normal text-rose-600">
                            Refunded
                          </Badge>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{row.sub}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={attachingKey != null}
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
