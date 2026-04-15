"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Loader2, Search, ShoppingBag } from "lucide-react"
import { format } from "date-fns"

type OrderRow = {
  id: string
  order_num: string | null
  status: string
  amount: number | string
  payment_method: string
  fulfillment_method: string | null
  created_at: string
  refunded_at: string | null
  buyer_id: string
  seller_id: string
}

function statusBadge(status: string) {
  switch (status) {
    case "confirmed":
      return <Badge variant="secondary">Confirmed</Badge>
    case "refunding":
      return (
        <Badge variant="outline" className="border-amber-500/40 text-amber-950 dark:text-amber-100">
          Refund in progress
        </Badge>
      )
    case "refunded":
      return <Badge variant="destructive">Refunded</Badge>
    case "pending":
      return <Badge variant="outline">Pending</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function paymentLabel(method: string) {
  if (method === "stripe") return "Card"
  if (method === "reswell_bucks") return "RB"
  return method
}

const PAGE_SIZE = 50

export default function AdminOrdersPage() {
  const [rows, setRows] = useState<OrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (search.trim()) params.set("q", search.trim())
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(offset))

      const res = await fetch(`/api/admin/orders?${params}`)
      const body = (await res.json()) as { data?: OrderRow[]; total?: number; error?: string }
      if (res.ok && body.data) {
        setRows(body.data)
        setTotal(body.total ?? 0)
      }
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search, offset])

  useEffect(() => {
    void fetchOrders()
  }, [fetchOrders])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    void fetchOrders()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground">
          All marketplace orders. Click an order to view details and take admin actions (refund, cancel).
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Order # or UUID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[240px]"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v)
            setOffset(0)
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="refunding">Refund in progress</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center">
              <ShoppingBag className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No orders found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">
                      {r.order_num ?? r.id.slice(0, 8)}
                      <span
                        className="block text-[11px] text-muted-foreground truncate max-w-[140px]"
                        title={r.id}
                      >
                        {r.id.slice(0, 8)}…
                      </span>
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      ${Number(r.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {paymentLabel(r.payment_method)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {format(new Date(r.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/orders/${r.id}`}
                        className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/90"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
