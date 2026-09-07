"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  type ContactMessageSupportStatus,
} from "@/lib/db/contactMessages"
import {
  type OrderSupportOutcome,
  type OrderSupportStatus,
} from "@/lib/db/order-support"
import { updateContactMessageAdminAction } from "@/lib/actions/contactMessagesAdmin"
import { updateOrderSupportAdminAction } from "@/lib/actions/orderSupportAdmin"
import { listAdminSupportInboxAction } from "@/lib/actions/adminSupportInbox"
import { sendSupportCaseAdminReplyAction } from "@/lib/actions/supportCaseThread"
import {
  filterInboxItems,
  type CaseInboxAssigneeFilter,
  type CaseInboxItem,
  type CaseInboxStatusFilter,
  type CaseInboxTypeFilter,
} from "@/lib/admin/case-inbox"
import { SupportCaseThread } from "@/components/features/support/support-case-thread"
import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"
import { getSupportCaseThreadAdminAction } from "@/lib/actions/supportCaseThread"
import { CaseAssigneeSelect } from "@/components/features/admin/case-assignee-select"
import { CaseIssueRefundPanel } from "@/components/features/admin/case-issue-refund-panel"
import { listSupportStaffAction } from "@/lib/actions/supportCaseAssign"
import type { StaffAssigneeRow } from "@/lib/db/searchInsightActions"
import { SupportMacrosPicker } from "@/components/features/admin/support-macros-picker"
import { ProtectionClaimDesk } from "@/components/features/admin/protection-claim-desk"
import {
  CaseOrderContextPanel,
  adminOrderParticipantDisplayName,
} from "@/components/features/admin/case-order-context-panel"
import { STATUS_LABEL, STATUS_LIST } from "@/components/features/admin/contact-messages-labels"
import type { AdminOrderDetail } from "@/lib/db/adminOrders"
import {
  contactStatusToCaseStatus,
  formatSupportCaseReference,
  orderSupportStatusToCaseStatus,
  SUPPORT_CASE_STATUS_LABEL,
} from "@/lib/utils/support-case-display"
import {
  adminSupportCaseHref,
  supportCaseResponseHref,
} from "@/lib/utils/support-case-paths"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  ExternalLink,
  Inbox,
  Loader2,
  MessageCircle,
  Package,
  RefreshCw,
  Search,
  Shield,
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

/** Deep link for order-type filter (legacy tab redirects land here). */
export const ADMIN_SUPPORT_INBOX_ORDER_SUPPORT_HREF = "/admin/contact-messages?type=order"

const STATUS_VIEWS: { id: CaseInboxStatusFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "new", label: "New" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
]

const TYPE_VIEWS: { id: CaseInboxTypeFilter; label: string }[] = [
  { id: "all", label: "All types" },
  { id: "general", label: "General" },
  { id: "order", label: "Orders" },
  { id: "claims", label: "Claims" },
]

const ASSIGNEE_VIEWS: { id: CaseInboxAssigneeFilter; label: string }[] = [
  { id: "anyone", label: "Anyone" },
  { id: "mine", label: "Mine" },
  { id: "unassigned", label: "Unassigned" },
]

const ORDER_STATUS_OPTIONS: { value: OrderSupportStatus; label: string }[] = [
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
  { value: "informed", label: "Informed" },
]

function KindIcon({ item }: { item: CaseInboxItem }) {
  if (item.kind === "protection_claim" || item.kind === "safety") {
    return <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
  }
  if (item.backend === "order_support") {
    return <Package className="h-3.5 w-3.5 shrink-0" aria-hidden />
  }
  return <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
}

function statusDotClass(item: CaseInboxItem): string {
  if (!item.isOpen) return "bg-muted-foreground/40"
  if (item.isNew) return "bg-amber-500"
  if (item.kind === "protection_claim" || item.kind === "safety") return "bg-rose-500"
  return "bg-sky-500"
}

export function CaseInboxAdminClient() {
  const pathname = usePathname() ?? "/admin/contact-messages"
  const router = useRouter()
  const searchParams = useSearchParams()

  const urlType: CaseInboxTypeFilter =
    searchParams.get("type") === "claims"
      ? "claims"
      : searchParams.get("type") === "general"
        ? "general"
        : searchParams.get("type") === "order" || searchParams.get("tab") === "order-support"
          ? "order"
          : "all"

  const urlStatus: CaseInboxStatusFilter =
    searchParams.get("status") === "new" ||
    searchParams.get("status") === "resolved" ||
    searchParams.get("status") === "all"
      ? (searchParams.get("status") as CaseInboxStatusFilter)
      : "open"

  const [items, setItems] = useState<CaseInboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<CaseInboxStatusFilter>(urlStatus)
  const [typeFilter, setTypeFilter] = useState<CaseInboxTypeFilter>(urlType)
  const [assigneeFilter, setAssigneeFilter] = useState<CaseInboxAssigneeFilter>(
    searchParams.get("assignee") === "mine" || searchParams.get("assignee") === "unassigned"
      ? (searchParams.get("assignee") as CaseInboxAssigneeFilter)
      : "anyone",
  )
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [staff, setStaff] = useState<StaffAssigneeRow[]>([])
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [cmStatus, setCmStatus] = useState<ContactMessageSupportStatus>("new")
  const [cmNotes, setCmNotes] = useState("")
  const [cmReply, setCmReply] = useState("")
  const [osStatus, setOsStatus] = useState<OrderSupportStatus>("new")
  const [osNotes, setOsNotes] = useState("")
  const [osOutcome, setOsOutcome] = useState<string>("none")
  const [osReply, setOsReply] = useState("")
  const [orderContext, setOrderContext] = useState<AdminOrderDetail | null>(null)
  const [threadReloadToken, setThreadReloadToken] = useState(0)
  const [threadMessages, setThreadMessages] = useState<SupportCaseThreadMessage[]>([])
  const [threadCaseId, setThreadCaseId] = useState<string | null>(null)

  const [savePending, startSave] = useTransition()
  const [replyPending, startReply] = useTransition()

  const onOrderContextLoaded = useCallback((detail: AdminOrderDetail) => {
    setOrderContext(detail)
  }, [])

  const syncUrl = useCallback(
    (status: CaseInboxStatusFilter, type: CaseInboxTypeFilter, assignee: CaseInboxAssigneeFilter) => {
      const q = new URLSearchParams()
      if (status !== "open") q.set("status", status)
      if (type !== "all") q.set("type", type)
      if (assignee !== "anyone") q.set("assignee", assignee)
      const qs = q.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") setRefreshing(true)
      else setLoading(true)

      const res = await listAdminSupportInboxAction()
      if ("error" in res) {
        toast.error(res.error)
        setItems([])
      } else {
        setItems(res.items)
      }
      setLoading(false)
      setRefreshing(false)
    },
    [],
  )

  useEffect(() => {
    void load("initial")
  }, [load])

  useEffect(() => {
    void listSupportStaffAction().then((res) => {
      if ("error" in res && res.error) return
      setStaff(res.rows)
      setCurrentStaffId(res.currentUserId)
      setIsAdmin(res.isAdmin === true)
    })
  }, [])

  const filtered = useMemo(
    () =>
      filterInboxItems(items, {
        status: statusFilter,
        type: typeFilter,
        assignee: assigneeFilter,
        currentStaffId,
        search,
      }),
    [items, statusFilter, typeFilter, assigneeFilter, currentStaffId, search],
  )

  const selected = useMemo(
    () => items.find((i) => i.key === selectedKey) ?? null,
    [items, selectedKey],
  )

  // Clear selection if the selected case falls out of the filter
  useEffect(() => {
    if (!selectedKey) return
    if (!filtered.some((i) => i.key === selectedKey)) {
      setSelectedKey(null)
    }
  }, [filtered, selectedKey])

  useEffect(() => {
    if (!selected) {
      setOrderContext(null)
      return
    }
    if (selected.contact) {
      setCmStatus(selected.contact.support_status)
      setCmNotes(selected.contact.internal_notes ?? "")
      setCmReply("")
    }
    if (selected.order) {
      setOsStatus(selected.order.support_status)
      setOsNotes(selected.order.internal_notes ?? "")
      setOsOutcome(selected.order.outcome ?? "none")
      setOsReply("")
    }
    if (!selected.orderId) {
      setOrderContext(null)
    }
  }, [selected])

  useEffect(() => {
    if (!selected) {
      setThreadMessages([])
      setThreadCaseId(null)
      return
    }
    void getSupportCaseThreadAdminAction(selected.id).then((res) => {
      if ("error" in res) {
        setThreadMessages([])
        setThreadCaseId(selected.id)
        return
      }
      setThreadCaseId(res.case.id)
      setThreadMessages(res.messages)
    })
  }, [selected, threadReloadToken])

  const counts = useMemo(() => {
    const open = items.filter((i) => i.isOpen).length
    const neu = items.filter((i) => i.isNew).length
    const claims = items.filter((i) => i.kind === "protection_claim" && i.isOpen).length
    const mine = items.filter((i) => i.isOpen && i.assigneeAdminId === currentStaffId).length
    const overdue = items.filter((i) => i.isOpen && i.slaState === "overdue").length
    return { open, neu, claims, mine, overdue, total: items.length }
  }, [items, currentStaffId])

  function setStatus(next: CaseInboxStatusFilter) {
    setStatusFilter(next)
    syncUrl(next, typeFilter, assigneeFilter)
  }

  function setType(next: CaseInboxTypeFilter) {
    setTypeFilter(next)
    syncUrl(statusFilter, next, assigneeFilter)
  }

  function setAssignee(next: CaseInboxAssigneeFilter) {
    setAssigneeFilter(next)
    syncUrl(statusFilter, typeFilter, next)
  }

  function applyAssignee(key: string, assigneeAdminId: string | null) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i
        return {
          ...i,
          assigneeAdminId,
          contact: i.contact ? { ...i.contact, assignee_admin_id: assigneeAdminId } : null,
          order: i.order ? { ...i.order, assignee_admin_id: assigneeAdminId } : null,
        }
      }),
    )
  }

  function patchItem(key: string, patch: Partial<CaseInboxItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  }

  function saveContact() {
    if (!selected?.contact) return
    const contact = selected.contact
    startSave(async () => {
      const res = await updateContactMessageAdminAction({
        id: contact.id,
        support_status: cmStatus,
        internal_notes: cmNotes,
      })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Saved")
      const now = new Date().toISOString()
      const updated = {
        ...contact,
        support_status: cmStatus,
        internal_notes: cmNotes,
        updated_at: now,
      }
      const status = contactStatusToCaseStatus(cmStatus)
      patchItem(selected.key, {
        contact: updated,
        status,
        statusLabel: SUPPORT_CASE_STATUS_LABEL[status],
        isOpen: status !== "resolved",
        isNew: status === "submitted",
        updatedAt: now,
      })
    })
  }

  function saveOrder() {
    if (!selected?.order) return
    const order = selected.order
    startSave(async () => {
      const res = await updateOrderSupportAdminAction({
        id: order.id,
        support_status: osStatus,
        internal_notes: osNotes.trim() || null,
        outcome: osOutcome === "none" ? null : (osOutcome as OrderSupportOutcome),
      })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Saved")
      const now = new Date().toISOString()
      const updated = {
        ...order,
        support_status: osStatus,
        internal_notes: osNotes.trim() || null,
        outcome: (osOutcome === "none" ? null : osOutcome) as OrderSupportOutcome | null,
        updated_at: now,
      }
      const status = orderSupportStatusToCaseStatus(osStatus)
      patchItem(selected.key, {
        order: updated,
        status,
        statusLabel: SUPPORT_CASE_STATUS_LABEL[status],
        isOpen: status !== "resolved",
        isNew: status === "submitted",
        updatedAt: now,
      })
    })
  }

  function sendInboxReply(body: string) {
    if (!selected) return
    if (!body) {
      toast.error("Write a message first.")
      return
    }
    startReply(async () => {
      const res = await sendSupportCaseAdminReplyAction({
        case_id: selected.id,
        content: body,
      })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Sent to customer")
      setCmReply("")
      setOsReply("")
      setThreadReloadToken((n) => n + 1)
    })
  }

  function sendReply() {
    sendInboxReply(cmReply.trim())
  }

  function sendOrderReply() {
    sendInboxReply(osReply.trim())
  }

  return (
    <div className="-m-4 flex h-[calc(100dvh-6.5rem)] min-h-[480px] flex-col overflow-hidden sm:-m-6">
      {/* Toolbar */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Cases</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums text-muted-foreground">
          <span>
            <strong className="font-semibold text-foreground">{counts.open}</strong> open
          </span>
          <span className="text-border">·</span>
          <span>
            <strong className="font-semibold text-foreground">{counts.neu}</strong> new
          </span>
          <span className="text-border">·</span>
          <span>
            <strong className="font-semibold text-foreground">{counts.claims}</strong> claims
          </span>
          <span className="text-border">·</span>
          <span>
            <strong className="font-semibold text-foreground">{counts.mine}</strong> mine
          </span>
          {counts.overdue > 0 ? (
            <>
              <span className="text-border">·</span>
              <span className="text-destructive">
                <strong className="font-semibold">{counts.overdue}</strong> overdue
              </span>
            </>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => void load("refresh")}
            disabled={refreshing}
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* List pane — hide on mobile when a case is open */}
        <aside
          className={cn(
            "min-w-0 flex-col border-border/60 md:flex md:shrink-0 md:border-r",
            selectedKey
              ? "hidden md:flex md:w-[240px] lg:w-[260px]"
              : "flex w-full md:w-[min(100%,360px)] lg:w-[380px]",
          )}
        >
          <div className="shrink-0 space-y-2 border-b border-border/50 px-3 py-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cases…"
                className="h-8 border-border/60 bg-muted/20 pl-8 text-sm"
                aria-label="Search cases"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {STATUS_VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setStatus(v.id)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    statusFilter === v.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {v.label}
                </button>
              ))}
              <span className="mx-0.5 self-center text-border" aria-hidden>
                |
              </span>
              {TYPE_VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setType(v.id)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    typeFilter === v.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {v.label}
                </button>
              ))}
              <span className="mx-0.5 self-center text-border" aria-hidden>
                |
              </span>
              {ASSIGNEE_VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setAssignee(v.id)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    assigneeFilter === v.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Loading…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center text-muted-foreground">
                <Inbox className="h-8 w-8 opacity-40" />
                <p className="text-sm">
                  {items.length === 0 ? "No cases yet." : "Nothing matches these filters."}
                </p>
              </div>
            ) : (
              <ul role="list" className="divide-y divide-border/40">
                {filtered.map((item) => {
                  const active = item.key === selectedKey
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => setSelectedKey(item.key)}
                        className={cn(
                          "flex w-full gap-2.5 px-3 py-2.5 text-left transition-colors",
                          active ? "bg-muted/70" : "hover:bg-muted/35",
                        )}
                      >
                        <span
                          className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", statusDotClass(item))}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 space-y-0.5">
                          <span className="flex items-start justify-between gap-2">
                            <span className="line-clamp-1 text-[13px] font-semibold text-foreground">
                              {item.subject}
                            </span>
                            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                              {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: false })}
                            </span>
                          </span>
                          <span className="line-clamp-1 text-[12px] text-muted-foreground">
                            {item.fromName}
                            {item.orderRef ? ` · #${item.orderRef}` : null}
                            {item.fromEmail ? ` · ${item.fromEmail}` : null}
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              <KindIcon item={item} />
                              {item.kindLabel}
                            </span>
                            <span className="text-[10px] text-muted-foreground/70">
                              {item.statusLabel}
                            </span>
                            {item.slaLabel ? (
                              <span
                                className={cn(
                                  "text-[10px]",
                                  item.slaState === "overdue"
                                    ? "font-medium text-destructive"
                                    : item.slaState === "due_soon"
                                      ? "text-amber-700 dark:text-amber-300"
                                      : "text-muted-foreground/70",
                                )}
                              >
                                {item.slaLabel}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Detail pane — desktop always; mobile when selected */}
        <section
          className={cn(
            "min-w-0 flex-1 flex-col",
            selectedKey ? "flex" : "hidden md:flex",
          )}
        >
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Inbox className="h-10 w-10 opacity-30" />
              <p className="text-sm">Select a case</p>
            </div>
          ) : (
            <>
              <div className="shrink-0 space-y-3 border-b border-border/60 px-5 py-4">
                <button
                  type="button"
                  className="mb-1 text-xs text-muted-foreground md:hidden"
                  onClick={() => setSelectedKey(null)}
                >
                  ← Back to list
                </button>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="font-normal">
                        {itemKindBadge(selected)}
                      </Badge>
                      <Badge variant={selected.isOpen ? "default" : "outline"} className="font-normal">
                        {selected.statusLabel}
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {formatSupportCaseReference(selected.id)}
                      </span>
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                      {selected.subject}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {orderContext && selected.orderId === orderContext.id ? (
                        <>
                          Buyer: {adminOrderParticipantDisplayName(orderContext.buyer)}
                          {" · "}
                          Seller: {adminOrderParticipantDisplayName(orderContext.seller)}
                        </>
                      ) : (
                        <>
                          {selected.fromName}
                          {selected.fromEmail ? ` · ${selected.fromEmail}` : null}
                        </>
                      )}
                      {" · "}
                      Updated{" "}
                      {formatDistanceToNow(new Date(selected.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.userId ? (
                      <Button variant="outline" size="sm" className="h-8" asChild>
                        <Link href={`/admin/users/${selected.userId}`}>
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          User
                        </Link>
                      </Button>
                    ) : null}
                    {selected.orderId ? (
                      <Button variant="outline" size="sm" className="h-8" asChild>
                        <Link href={`/admin/orders/${selected.orderId}`}>
                          <Package className="mr-1.5 h-3.5 w-3.5" />
                          Order
                        </Link>
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" className="h-8" asChild>
                      <Link href={adminSupportCaseHref(selected.id)}>
                        <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                        Thread desk
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="space-y-5 px-5 py-5">
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Message
                      </p>
                      <div className="rounded-lg border border-border/60 bg-muted/15 px-4 py-3">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {selected.preview}
                        </p>
                      </div>
                      {selected.order?.contacted_seller_first != null ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Messaged seller first:{" "}
                          {selected.order.contacted_seller_first ? "Yes" : "No"}
                        </p>
                      ) : null}
                    </div>

                    {selected.orderId ? (
                      <CaseOrderContextPanel
                        orderId={selected.orderId}
                        orderSupportRequestId={selected.order?.id ?? null}
                        onLoaded={onOrderContextLoaded}
                      />
                    ) : null}

                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Reply to customer
                      </p>
                      <div className="min-h-[16rem] rounded-[20px] border border-border/55 bg-background px-2">
                        <SupportCaseThread
                          caseId={threadCaseId ?? selected.id}
                          messages={threadMessages}
                          canReply={false}
                          role="staff"
                        />
                      </div>
                      <SupportMacrosPicker
                        kindFilter={
                          selected.kind === "protection_claim"
                            ? "protection_claim"
                            : selected.kind === "cancel_request"
                              ? "cancel_request"
                              : null
                        }
                        vars={{
                          order_ref: selected.orderRef ?? undefined,
                          name: selected.fromName,
                        }}
                        onInsert={(text) => {
                          if (selected.order) {
                            setOsReply((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))
                          } else {
                            setCmReply((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))
                          }
                        }}
                      />
                      <Textarea
                        value={selected.order ? osReply : cmReply}
                        onChange={(e) =>
                          selected.order ? setOsReply(e.target.value) : setCmReply(e.target.value)
                        }
                        placeholder="Message the customer will see under Help…"
                        rows={4}
                        className="resize-y text-sm"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={selected.order ? sendOrderReply : sendReply}
                          disabled={
                            replyPending || !(selected.order ? osReply.trim() : cmReply.trim())
                          }
                        >
                          {replyPending ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Send reply
                        </Button>
                        <Button type="button" size="sm" variant="outline" asChild>
                          <Link href={adminSupportCaseHref(selected.id)} target="_blank">
                            Open thread desk
                          </Link>
                        </Button>
                        <Button type="button" size="sm" variant="ghost" asChild>
                          <Link href={supportCaseResponseHref(selected.id)} target="_blank">
                            Customer view
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Right tools */}
                  <aside className="space-y-4 border-t border-border/50 bg-muted/10 px-4 py-5 lg:border-l lg:border-t-0">
                    <CaseAssigneeSelect
                      backend="support_case"
                      caseId={selected.id}
                      assigneeAdminId={selected.assigneeAdminId}
                      staff={staff}
                      currentUserId={currentStaffId}
                      onAssigned={(id) => applyAssignee(selected.key, id)}
                    />
                    {selected.slaLabel ? (
                      <p
                        className={cn(
                          "text-xs",
                          selected.slaState === "overdue"
                            ? "font-medium text-destructive"
                            : selected.slaState === "due_soon"
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-muted-foreground",
                        )}
                      >
                        SLA {selected.slaLabel.toLowerCase()}
                      </p>
                    ) : null}

                    {selected.contact ? (
                      <>
                        <div className="space-y-2">
                          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Status
                          </Label>
                          <Select
                            value={cmStatus}
                            onValueChange={(v) => setCmStatus(v as ContactMessageSupportStatus)}
                          >
                            <SelectTrigger className="h-9 bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_LIST.map((k) => (
                                <SelectItem key={k} value={k}>
                                  {STATUS_LABEL[k]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Internal notes
                          </Label>
                          <SupportMacrosPicker
                            vars={{ name: selected.fromName }}
                            onInsert={(text) =>
                              setCmNotes((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))
                            }
                          />
                          <Textarea
                            value={cmNotes}
                            onChange={(e) => setCmNotes(e.target.value)}
                            rows={5}
                            placeholder="Staff only…"
                            className="resize-y bg-background text-sm"
                          />
                        </div>
                        <Button
                          type="button"
                          className="w-full"
                          onClick={saveContact}
                          disabled={savePending}
                        >
                          {savePending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                          Save
                        </Button>
                      </>
                    ) : null}

                    {selected.order ? (
                      <>
                        <div className="space-y-2">
                          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Status
                          </Label>
                          <Select
                            value={osStatus}
                            onValueChange={(v) => setOsStatus(v as OrderSupportStatus)}
                          >
                            <SelectTrigger className="h-9 bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ORDER_STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Outcome
                          </Label>
                          <Select value={osOutcome} onValueChange={setOsOutcome}>
                            <SelectTrigger className="h-9 bg-background">
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
                          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Internal notes
                          </Label>
                          <Textarea
                            value={osNotes}
                            onChange={(e) => setOsNotes(e.target.value)}
                            rows={4}
                            placeholder="Staff only — not emailed…"
                            className="resize-y bg-background text-sm"
                          />
                        </div>
                        <Button
                          type="button"
                          className="w-full"
                          onClick={saveOrder}
                          disabled={savePending}
                        >
                          {savePending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                          Save status
                        </Button>
                        {orderContext && selected.orderId === orderContext.id ? (
                          <CaseIssueRefundPanel
                            caseId={selected.id}
                            orderId={orderContext.id}
                            orderRef={selected.orderRef ?? orderContext.order_num ?? selected.id}
                            orderStatus={orderContext.status}
                            amount={orderContext.amount}
                            shippingAmount={orderContext.shipping_amount}
                            paymentMethod={orderContext.payment_method}
                            repairCreditTotal={selected.order.repair_credit_total}
                            canIssueRefund={isAdmin}
                            onComplete={() => void load("refresh")}
                          />
                        ) : null}
                        {selected.kind === "protection_claim" && selected.orderId ? (
                          <ProtectionClaimDesk
                            orderSupportRequestId={selected.order.id}
                            orderId={selected.orderId}
                            initialCarrierClaimStatus={selected.order.carrier_claim_status}
                            initialCarrierClaimId={selected.order.carrier_claim_id}
                            initialCarrierClaimUrl={selected.order.carrier_claim_url}
                            initialInsuranceClaimUrl={selected.order.insurance_claim_url}
                            initialRepairCreditTotal={selected.order.repair_credit_total}
                          />
                        ) : null}
                        <Button type="button" variant="outline" className="w-full" asChild>
                          <Link href={`/admin/orders/${selected.orderId}`}>
                            Open order tools
                          </Link>
                        </Button>
                      </>
                    ) : null}

                    <p className="pt-2 font-mono text-[10px] leading-relaxed text-muted-foreground break-all">
                      {selected.channelLabel} · {selected.id}
                    </p>
                  </aside>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function itemKindBadge(item: CaseInboxItem): string {
  if (item.kind === "protection_claim") return "Claim"
  if (item.kind === "cancel_request") return "Cancel"
  if (item.backend === "order_support") return "Order"
  return item.channelLabel
}

/** @deprecated Use CaseInboxAdminClient — kept for existing imports. */
export const ContactMessagesAdminClient = CaseInboxAdminClient
