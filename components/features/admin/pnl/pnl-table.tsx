"use client"

import Link from "next/link"
import { ExternalLink, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  formatCurrency,
  formatPercent,
  statusLabel,
  type PnlComputedEntry,
} from "@/lib/pnl-calc"
import type { PnlStatus } from "@/lib/db/pnl"
import { PnlInlinePrice } from "./pnl-inline-price"

interface PnlTableProps {
  rows: PnlComputedEntry[]
  onEdit: (entry: PnlComputedEntry) => void
  onDelete: (entry: PnlComputedEntry) => void
  onUpdatePurchasePrice: (id: string, price: number) => Promise<boolean>
}

const STATUS_VARIANT: Record<PnlStatus, string> = {
  sold: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  listed: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  inventory: "bg-muted text-muted-foreground hover:bg-muted",
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return value
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
    timeZone: "UTC",
  })
}

export function PnlTable({ rows, onEdit, onDelete, onUpdatePurchasePrice }: PnlTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
        No boards match these filters yet. Add your first board to start tracking.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Board</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Bought</TableHead>
            <TableHead className="text-right">Fees</TableHead>
            <TableHead className="text-right">Sold</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead className="text-right">ROI</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const fees = row.shipping_cost + row.platform_fee + row.other_costs
            return (
              <TableRow key={row.id}>
                <TableCell className="max-w-[240px]">
                  <div className="truncate font-medium">{row.board_name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {row.category && <span className="truncate">{row.category}</span>}
                    {row.order_id ? (
                      <Link
                        href={`/admin/orders/${row.order_id}`}
                        className="inline-flex shrink-0 items-center gap-1 text-sky-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Reswell {row.order_role === "seller" ? "sale" : "purchase"}
                      </Link>
                    ) : (
                      (row.listing_slug || row.listing_id) && (
                        <Link
                          href={`/l/${row.listing_slug || row.listing_id}`}
                          target="_blank"
                          className="inline-flex shrink-0 items-center gap-1 text-violet-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Active listing
                        </Link>
                      )
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("font-normal", STATUS_VARIANT[row.status])}>
                    {statusLabel(row.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <PnlInlinePrice
                    value={row.purchase_price}
                    onSave={(price) => onUpdatePurchasePrice(row.id, price)}
                  />
                  <div className="text-xs text-muted-foreground">{formatDate(row.purchase_date)}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {fees > 0 ? formatCurrency(fees) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <div>{row.sale_price != null ? formatCurrency(row.sale_price) : "—"}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(row.sale_date)}</div>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium tabular-nums",
                    row.profit == null
                      ? "text-muted-foreground"
                      : row.profit >= 0
                        ? "text-emerald-600"
                        : "text-rose-600",
                  )}
                >
                  {row.profit == null ? "—" : formatCurrency(row.profit)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatPercent(row.roi)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Row actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(row)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-rose-600 focus:text-rose-600"
                        onClick={() => onDelete(row)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
