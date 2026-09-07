"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  normalizeOrderSupportRow,
  ORDER_SUPPORT_SELECT,
  type OrderSupportOutcome,
  type OrderSupportRequestRow,
  type OrderSupportStatus,
} from "@/lib/db/order-support"
import { updateOrderSupportAdminAction } from "@/lib/actions/orderSupportAdmin"
import { Card, CardContent } from "@/components/ui/card"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { LifeBuoy, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { SupportMacrosPicker } from "@/components/features/admin/support-macros-picker"

const STATUS_OPTIONS: { value: OrderSupportStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "triaged", label: "Triaged" },
  { value: "waiting_on_customer", label: "Waiting on customer" },
  { value: "investigating", label: "Investigating" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
]

const OUTCOME_OPTIONS: { value: OrderSupportOutcome; label: string }[] = [
  { value: "approved", label: "Approved" },
  { value: "partial", label: "Partial" },
  { value: "denied", label: "Denied" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "cancelled", label: "Cancelled" },
  { value: "informed", label: "Informed / no action" },
]

function typeLabel(t: string) {
  switch (t) {
    case "help":
      return "Question"
    case "cancel_order":
      return "Cancel"
    case "refund_help":
      return "Protection claim"
    default:
      return t
  }
}

function statusBadgeVariant(
  status: OrderSupportStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "new":
      return "destructive"
    case "investigating":
      return "default"
    case "resolved":
    case "closed":
      return "outline"
    default:
      return "secondary"
  }
}

export function OrderSupportRequestsPanel() {
  const [rows, setRows] = useState<OrderSupportRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("open")
  const [selected, setSelected] = useState<OrderSupportRequestRow | null>(null)
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<OrderSupportStatus>("new")
  const [outcome, setOutcome] = useState<string>("none")
  const [pending, startTransition] = useTransition()
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("order_support_requests")
      .select(ORDER_SUPPORT_SELECT)
      .order("created_at", { ascending: false })
      .limit(200)

    if (!error && data) {
      setRows(data.map((r) => normalizeOrderSupportRow(r as Record<string, unknown>)))
    } else {
      const legacy = await supabase
        .from("order_support_requests")
        .select(
          "id, order_id, buyer_id, request_type, body, contacted_seller_first, order_ref, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200)
      if (!legacy.error && legacy.data) {
        setRows(
          legacy.data.map((r) =>
            normalizeOrderSupportRow({
              ...(r as Record<string, unknown>),
              support_status: "new",
              requester_role: "buyer",
              assignee_admin_id: null,
              internal_notes: null,
              outcome: null,
              updated_at: (r as { created_at: string }).created_at,
            }),
          ),
        )
      }
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows
    if (statusFilter === "open") {
      return rows.filter((r) => r.support_status !== "resolved" && r.support_status !== "closed")
    }
    return rows.filter((r) => r.support_status === statusFilter)
  }, [rows, statusFilter])

  function openRow(row: OrderSupportRequestRow) {
    setSelected(row)
    setNotes(row.internal_notes ?? "")
    setStatus(row.support_status)
    setOutcome(row.outcome ?? "none")
  }

  function saveSelected() {
    if (!selected) return
    startTransition(async () => {
      const res = await updateOrderSupportAdminAction({
        id: selected.id,
        support_status: status,
        internal_notes: notes.trim() || null,
        outcome: outcome === "none" ? null : (outcome as OrderSupportOutcome),
      })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Case updated")
      setSelected(null)
      await load()
    })
  }

  const openCount = rows.filter(
    (r) => r.support_status !== "resolved" && r.support_status !== "closed",
  ).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Order cases</h2>
          <p className="text-muted-foreground">
            Questions, cancellations, and Purchase Protection claims tied to an order. Update status
            here; issue refunds from the order page.
          </p>
        </div>
        <Badge variant="secondary" className="tabular-nums">
          {openCount} open
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["open", "Open"],
            ["all", "All"],
            ["new", "New"],
            ["investigating", "Investigating"],
            ["resolved", "Resolved"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={statusFilter === value ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <LifeBuoy className="mx-auto mb-2 h-8 w-8 animate-pulse text-muted-foreground" />
              <p className="text-muted-foreground">Loading…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <LifeBuoy className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">No order cases in this view</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="max-w-[min(40vw,360px)]">Message</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(r.created_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="font-mono text-sm">#{r.order_ref}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{typeLabel(r.request_type)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm capitalize text-muted-foreground">
                      {r.requester_role}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(r.support_status)}>
                        {STATUS_OPTIONS.find((s) => s.value === r.support_status)?.label ??
                          r.support_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[360px] truncate text-sm">{r.body}</TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => openRow(r)}>
                        Triage
                      </Button>
                      <Link
                        href={`/admin/orders/${r.order_id}`}
                        className="text-sm font-medium text-primary underline underline-offset-4"
                      >
                        Order
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Triage order case</SheetTitle>
            <SheetDescription>
              {selected ? `${typeLabel(selected.request_type)} · #${selected.order_ref}` : null}
            </SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="flex-1 space-y-4 overflow-y-auto py-4">
              <div className="rounded-xl border bg-muted/20 px-3 py-2 text-sm whitespace-pre-wrap">
                {selected.body}
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as OrderSupportStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Outcome (claims / cancels)</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {OUTCOME_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-case-notes">Internal notes</Label>
                <SupportMacrosPicker
                  kindFilter={
                    selected.request_type === "refund_help"
                      ? "protection_claim"
                      : selected.request_type === "cancel_order"
                        ? "cancel_request"
                        : null
                  }
                  vars={{ order_ref: selected.order_ref }}
                  onInsert={(text) =>
                    setNotes((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))
                  }
                />
                <Textarea
                  id="order-case-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Visible only to staff…"
                />
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/admin/orders/${selected.order_id}`}>
                  Open order (refund / cancel tools)
                </Link>
              </Button>
            </div>
          ) : null}
          <SheetFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setSelected(null)} disabled={pending}>
              Close
            </Button>
            <Button type="button" onClick={saveSelected} disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
