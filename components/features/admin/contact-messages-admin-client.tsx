"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  CONTACT_MESSAGE_ADMIN_SELECT,
  normalizeContactMessageRow,
  type ContactMessageRow,
  type ContactMessageSource,
  type ContactMessageSupportStatus,
} from "@/lib/db/contactMessages"
import {
  bulkUpdateContactMessagesAdminAction,
  ensureSupportTicketThreadAdminAction,
  sendSupportTicketAdminReplyAction,
  updateContactMessageAdminAction,
} from "@/lib/actions/contactMessagesAdmin"
import { buildContactTicketDraft } from "@/lib/utils/contactMessageTicket"
import {
  CHANNEL_LABEL,
  STATUS_LABEL,
  STATUS_LIST,
  STATUS_ORDER,
  channelBadgeVariant,
  statusBadgeVariant,
} from "@/components/features/admin/contact-messages-labels"
import { computeContactMessagesStats } from "@/components/features/admin/contact-messages-stats"
import { downloadTicketsCsv } from "@/components/features/admin/contact-messages-export"
import { ContactMessagesAnalytics } from "@/components/features/admin/contact-messages-analytics"
import { ContactMessagesBulkBar } from "@/components/features/admin/contact-messages-bulk-bar"
import {
  CONTACT_MESSAGES_DEFAULT_FILTERS,
  CONTACT_MESSAGES_SEGMENTS,
  activeSegmentId,
  type ContactMessagesFilterState,
} from "@/components/features/admin/contact-messages-segments"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OrderSupportRequestsPanel } from "@/components/features/admin/order-support-requests-panel"
import {
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Download,
  ExternalLink,
  Inbox,
  LifeBuoy,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

const SUPPORT_INBOX_TAB_QUERY = "tab"
const SUPPORT_INBOX_ORDER_TAB = "order-support"
/** Deep link for the Order support tab (use for Links and redirects). */
export const ADMIN_SUPPORT_INBOX_ORDER_SUPPORT_HREF = `/admin/contact-messages?${SUPPORT_INBOX_TAB_QUERY}=${SUPPORT_INBOX_ORDER_TAB}`

const SELECT = CONTACT_MESSAGE_ADMIN_SELECT
const DAY_MS = 24 * 60 * 60 * 1000

type SortKey = "received" | "updated" | "status" | "name"

const SORT_LABEL: Record<SortKey, string> = {
  received: "Newest first",
  updated: "Recently updated",
  status: "Workflow stage",
  name: "Name (A–Z)",
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  accent,
}: {
  title: string
  value: number
  description: string
  icon: typeof Inbox
  accent: string
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardContent className="relative p-5">
        <div className={cn("absolute inset-0 opacity-[0.07]", accent)} />
        <div className="relative flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={cn("rounded-xl p-2.5", accent.replace("bg-", "bg-opacity-15 bg-"))}>
            <Icon className={cn("h-5 w-5", accent.replace("bg-", "text-").replace("-500", "-600"))} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ContactMessagesAdminClient() {
  const pathname = usePathname() ?? "/admin/contact-messages"
  const router = useRouter()
  const searchParams = useSearchParams()

  const sectionTab =
    searchParams.get(SUPPORT_INBOX_TAB_QUERY) === SUPPORT_INBOX_ORDER_TAB ? "order-support" : "inbox"

  const setSectionTab = useCallback(
    (value: string) => {
      if (value !== "inbox" && value !== "order-support") return
      const q = new URLSearchParams(searchParams.toString())
      if (value === "inbox") {
        q.delete(SUPPORT_INBOX_TAB_QUERY)
      } else {
        q.set(SUPPORT_INBOX_TAB_QUERY, SUPPORT_INBOX_ORDER_TAB)
      }
      const qs = q.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const [rows, setRows] = useState<ContactMessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<ContactMessagesFilterState>(CONTACT_MESSAGES_DEFAULT_FILTERS)
  const [sort, setSort] = useState<SortKey>("received")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [active, setActive] = useState<ContactMessageRow | null>(null)
  const [draftStatus, setDraftStatus] = useState<ContactMessageSupportStatus>("new")
  const [draftNotes, setDraftNotes] = useState("")
  const [draftReply, setDraftReply] = useState("")
  const [savePending, startSaveTransition] = useTransition()
  const [replyPending, startReplyTransition] = useTransition()
  const [threadPending, startThreadTransition] = useTransition()
  const [bulkBusy, setBulkBusy] = useState(false)
  const supabase = createClient()

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") setRefreshing(true)
      else setLoading(true)
      const { data, error } = await supabase
        .from("contact_messages")
        .select(SELECT)
        .order("created_at", { ascending: false })
        .limit(500)

      if (error) {
        console.error(error)
        toast.error("Could not load tickets. If this persists, run the latest database migration.")
        setRows([])
      } else {
        setRows((data ?? []).map((r) => normalizeContactMessageRow(r as Record<string, unknown>)))
      }
      setLoading(false)
      setRefreshing(false)
    },
    [supabase],
  )

  useEffect(() => {
    void load("initial")
  }, [load])

  useEffect(() => {
    if (!active) return
    setDraftStatus(active.support_status)
    setDraftNotes(active.internal_notes ?? "")
    setDraftReply("")
  }, [active])

  const stats = useMemo(() => computeContactMessagesStats(rows), [rows])
  const currentSegment = useMemo(() => activeSegmentId(filters), [filters])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const cutoff =
      filters.createdWithinDays != null ? Date.now() - filters.createdWithinDays * DAY_MS : null

    const matched = rows.filter((r) => {
      if (filters.status !== "all" && r.support_status !== filters.status) return false
      if (filters.channel !== "all" && r.source !== filters.channel) return false
      if (cutoff != null && new Date(r.created_at).getTime() < cutoff) return false
      if (!q) return true
      const subj = (r.subject ?? "").toLowerCase()
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q) ||
        subj.includes(q) ||
        (r.user_id?.toLowerCase().includes(q) ?? false) ||
        (r.related_conversation_id?.toLowerCase().includes(q) ?? false) ||
        (r.support_conversation_id?.toLowerCase().includes(q) ?? false)
      )
    })

    const sorted = [...matched]
    sorted.sort((a, b) => {
      switch (sort) {
        case "updated":
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        case "status":
          return STATUS_ORDER[a.support_status] - STATUS_ORDER[b.support_status]
        case "name":
          return a.name.localeCompare(b.name)
        case "received":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
    return sorted
  }, [rows, search, filters, sort])

  const visibleIds = useMemo(() => filtered.map((r) => r.id), [filtered])
  const selectedVisibleCount = useMemo(
    () => visibleIds.filter((id) => selectedIds.has(id)).length,
    [visibleIds, selectedIds],
  )
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const everySelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id))
      if (everySelected) {
        for (const id of visibleIds) next.delete(id)
      } else {
        for (const id of visibleIds) next.add(id)
      }
      return next
    })
  }, [visibleIds])

  const applySegment = useCallback(
    (segmentFilters: ContactMessagesFilterState) => {
      setFilters(segmentFilters)
      clearSelection()
    },
    [clearSelection],
  )

  function copyText(label: string, text: string) {
    void navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Copy failed"),
    )
  }

  const exportSelected = useCallback(() => {
    const chosen = selectedIds.size > 0 ? filtered.filter((r) => selectedIds.has(r.id)) : filtered
    if (chosen.length === 0) {
      toast.error("Nothing to export.")
      return
    }
    downloadTicketsCsv(chosen)
    toast.success(`Exported ${chosen.length} ticket${chosen.length === 1 ? "" : "s"}`)
  }, [filtered, selectedIds])

  const runBulkStatus = useCallback(
    (status: ContactMessageSupportStatus) => {
      const ids = Array.from(selectedIds)
      if (ids.length === 0) return
      setBulkBusy(true)
      void (async () => {
        const res = await bulkUpdateContactMessagesAdminAction({ ids, support_status: status })
        if ("error" in res && res.error) {
          toast.error(res.error)
          setBulkBusy(false)
          return
        }
        const now = new Date().toISOString()
        setRows((prev) =>
          prev.map((r) =>
            selectedIds.has(r.id) ? { ...r, support_status: status, updated_at: now } : r,
          ),
        )
        toast.success(`Updated ${ids.length} ticket${ids.length === 1 ? "" : "s"} to ${STATUS_LABEL[status]}`)
        clearSelection()
        setBulkBusy(false)
      })()
    },
    [selectedIds, clearSelection],
  )

  function mergeConversationIntoRows(
    ticketId: string,
    conversationId: string | null | undefined,
    updatedIso: string,
  ) {
    if (!conversationId) return
    setRows((prev) =>
      prev.map((r) =>
        r.id === ticketId
          ? { ...r, support_conversation_id: conversationId, updated_at: updatedIso }
          : r,
      ),
    )
    setActive((cur) =>
      cur && cur.id === ticketId
        ? { ...cur, support_conversation_id: conversationId, updated_at: updatedIso }
        : cur,
    )
  }

  function sendMemberReply() {
    if (!active) return
    const body = draftReply.trim()
    if (!body) {
      toast.error("Write a message first.")
      return
    }
    startReplyTransition(async () => {
      const res = await sendSupportTicketAdminReplyAction({
        ticket_id: active.id,
        content: body,
      })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Message sent — member sees it in Messages.")
      const now = new Date().toISOString()
      mergeConversationIntoRows(active.id, res.support_conversation_id, now)
      setDraftReply("")
    })
  }

  function openSupportThread() {
    if (!active) return
    startThreadTransition(async () => {
      const res = await ensureSupportTicketThreadAdminAction({ ticket_id: active.id })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Support thread linked.")
      const now = new Date().toISOString()
      mergeConversationIntoRows(active.id, res.support_conversation_id, now)
    })
  }

  function saveDetail() {
    if (!active) return
    startSaveTransition(async () => {
      const res = await updateContactMessageAdminAction({
        id: active.id,
        support_status: draftStatus,
        internal_notes: draftNotes,
      })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Saved")
      const now = new Date().toISOString()
      setRows((prev) =>
        prev.map((r) =>
          r.id === active.id
            ? { ...r, support_status: draftStatus, internal_notes: draftNotes, updated_at: now }
            : r,
        ),
      )
      setActive((cur) =>
        cur && cur.id === active.id
          ? { ...cur, support_status: draftStatus, internal_notes: draftNotes, updated_at: now }
          : cur,
      )
    })
  }

  return (
    <Tabs value={sectionTab} onValueChange={setSectionTab} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-teal-500 to-sky-600 p-2 text-white shadow-sm">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Support inbox</h1>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Triage website contact and in-app Messages tickets. Open a ticket to chat in the same thread the
            member sees under <strong>Dashboard → Support</strong>; workflow changes notify them automatically
            when a thread is linked.
          </p>
        </div>
        <TabsList className="h-auto w-full shrink-0 flex-wrap justify-start gap-1 p-1 sm:w-auto">
          <TabsTrigger value="inbox" className="gap-1.5">
            <Inbox className="h-4 w-4" aria-hidden />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="order-support" className="gap-1.5">
            <LifeBuoy className="h-4 w-4" aria-hidden />
            Order support
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="inbox" className="mt-0 space-y-6 outline-none">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Open tickets"
            value={stats.open}
            description="Not yet resolved"
            icon={Inbox}
            accent="bg-sky-500"
          />
          <StatCard
            title="Awaiting reply"
            value={stats.awaitingReply}
            description="New or triaged"
            icon={Clock}
            accent="bg-amber-500"
          />
          <StatCard
            title="In progress"
            value={stats.inProgress}
            description="Being worked"
            icon={MessageCircle}
            accent="bg-violet-500"
          />
          <StatCard
            title="Resolved"
            value={stats.resolved}
            description={`${stats.resolutionRate}% resolution rate`}
            icon={CheckCircle2}
            accent="bg-emerald-500"
          />
        </div>

        <ContactMessagesAnalytics stats={stats} />

        <div className="flex flex-wrap items-center gap-2">
          {CONTACT_MESSAGES_SEGMENTS.map((segment) => {
            const Icon = segment.icon
            const isActive = currentSegment === segment.id
            return (
              <button
                key={segment.id}
                type="button"
                onClick={() => applySegment(segment.filters)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-teal-500 bg-teal-500 text-white shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {segment.label}
              </button>
            )
          })}
        </div>

        <Card className="overflow-hidden border-border/80">
          <div className="space-y-4 border-b border-border/60 bg-muted/15 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, topic, or message…"
                  className="pl-9"
                  aria-label="Search support tickets"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={filters.channel}
                  onValueChange={(v) =>
                    setFilters((f) => ({ ...f, channel: v as ContactMessagesFilterState["channel"] }))
                  }
                >
                  <SelectTrigger className="w-[150px]" aria-label="Filter by channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All channels</SelectItem>
                    <SelectItem value="messages_support">In-app ({stats.channelCounts.messages_support})</SelectItem>
                    <SelectItem value="contact_form">Website ({stats.channelCounts.contact_form})</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  <SelectTrigger className="w-[170px]" aria-label="Sort tickets">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {SORT_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void load("refresh")}
                  disabled={refreshing}
                  aria-label="Refresh"
                >
                  <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                </Button>
                <Button variant="outline" onClick={exportSelected} disabled={filtered.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>

            <Tabs
              value={filters.status}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, status: v as ContactMessagesFilterState["status"] }))
              }
            >
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1.5 p-1 sm:inline-flex sm:h-10 sm:w-auto">
                <TabsTrigger value="all" className="text-xs sm:text-sm">
                  All ({rows.length})
                </TabsTrigger>
                {STATUS_LIST.map((k) => (
                  <TabsTrigger key={k} value={k} className="text-xs sm:text-sm">
                    {STATUS_LABEL[k]} ({stats.statusCounts[k]})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {selectedIds.size > 0 ? (
              <ContactMessagesBulkBar
                count={selectedIds.size}
                isPending={bulkBusy}
                onClear={clearSelection}
                onSetStatus={(status) => runBulkStatus(status)}
                onExport={exportSelected}
              />
            ) : null}
          </div>

          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Loading tickets…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <Inbox className="h-10 w-10 opacity-50" />
                <p className="text-sm">
                  {rows.length === 0 ? "No tickets yet." : "Nothing matches these filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[44px]">
                        <Checkbox
                          checked={
                            allVisibleSelected
                              ? true
                              : selectedVisibleCount > 0
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={toggleAllVisible}
                          aria-label="Select all visible tickets"
                        />
                      </TableHead>
                      <TableHead className="w-[104px]">Channel</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[140px]">Received</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead className="min-w-[200px]">Preview</TableHead>
                      <TableHead className="w-[1%] text-right">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const isSelected = selectedIds.has(r.id)
                      return (
                        <TableRow
                          key={r.id}
                          data-state={isSelected ? "selected" : undefined}
                          className="cursor-pointer"
                          onClick={() => setActive(r)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleRow(r.id)}
                              aria-label={`Select ticket from ${r.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={channelBadgeVariant(r.source)}
                              className={cn(
                                "font-normal",
                                r.source === "contact_form" && "bg-muted/90 text-foreground",
                              )}
                            >
                              {CHANNEL_LABEL[r.source]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={statusBadgeVariant(r.support_status)}
                              className={cn(
                                "font-normal",
                                r.support_status === "resolved" &&
                                  "border-transparent bg-muted text-muted-foreground",
                              )}
                            >
                              {STATUS_LABEL[r.support_status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            <span title={format(new Date(r.created_at), "PPpp")}>
                              {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">{r.name}</div>
                            <a
                              href={`mailto:${r.email}`}
                              className="text-sm text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.email}
                            </a>
                          </TableCell>
                          <TableCell className="max-w-[min(52vw,480px)]">
                            <p className="line-clamp-1 text-xs font-medium text-foreground/90">
                              {r.subject ?? "—"}
                            </p>
                            <p className="line-clamp-2 text-sm text-muted-foreground">{r.message}</p>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {r.user_id ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-primary"
                                  asChild
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Link href={`/admin/contact-messages/${r.id}`}>
                                    {r.support_conversation_id ? "Open thread" : "Start thread"}
                                  </Link>
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActive(r)
                                }}
                              >
                                Review
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Sheet open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
          <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto border-l border-border/80 bg-background p-0 shadow-2xl sm:max-w-lg">
            {active && (
              <>
                <SheetHeader className="space-y-3 border-b border-border/60 bg-muted/20 px-6 py-5 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={channelBadgeVariant(active.source)} className="font-medium">
                      {CHANNEL_LABEL[active.source]}
                    </Badge>
                    <Badge variant={statusBadgeVariant(active.support_status)} className="font-medium">
                      {STATUS_LABEL[active.support_status]}
                    </Badge>
                  </div>
                  <div>
                    <SheetTitle className="pr-6 text-2xl font-semibold tracking-tight">Support ticket</SheetTitle>
                    <SheetDescription className="mt-1.5 text-[13px]">
                      {format(new Date(active.created_at), "PPpp")}
                      <span className="text-muted-foreground"> · </span>
                      {formatDistanceToNow(new Date(active.created_at), { addSuffix: true })}
                    </SheetDescription>
                  </div>
                </SheetHeader>

                <div className="flex-1 space-y-6 px-6 py-6">
                  <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                    <p className="text-sm font-semibold text-foreground">{active.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{active.email}</p>
                    {active.subject ? (
                      <div className="mt-3 border-t border-border/50 pt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Topic</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{active.subject}</p>
                      </div>
                    ) : null}
                  </div>

                  {active.user_id ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" className="gap-1.5 rounded-full" asChild>
                          <Link href={`/admin/users/${active.user_id}`}>
                            <ExternalLink className="h-4 w-4" />
                            User in admin
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 rounded-full"
                          onClick={() => copyText("User ID", active.user_id!)}
                        >
                          <ClipboardCopy className="h-4 w-4" />
                          Copy user ID
                        </Button>
                      </div>

                      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Reply to member
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Sends from your configured support teammate — the member reads it under{" "}
                          <strong>Dashboard → Support</strong>. Sending also links a thread if this ticket did
                          not have one yet.
                        </p>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="mt-1 h-auto px-0 text-primary"
                          asChild
                        >
                          <Link href={`/admin/contact-messages/${active.id}`}>
                            Open full support thread
                          </Link>
                        </Button>
                        {!active.support_conversation_id ? (
                          <p className="mt-2 text-sm text-amber-700 dark:text-amber-500/90">
                            No support thread linked yet. Send a reply below, or use &quot;Open support thread&quot; to
                            link the chat and post an intro.
                          </p>
                        ) : null}
                        <div className="mt-4 space-y-2">
                          <Label htmlFor="cm-reply" className="sr-only">
                            Message to member
                          </Label>
                          <Textarea
                            id="cm-reply"
                            value={draftReply}
                            onChange={(e) => setDraftReply(e.target.value)}
                            placeholder="Write the message the member will see in Messages…"
                            rows={4}
                            className="min-h-[100px] resize-y rounded-xl text-[15px]"
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            className="gap-1.5 rounded-full"
                            onClick={sendMemberReply}
                            disabled={replyPending || threadPending || !draftReply.trim()}
                          >
                            {replyPending ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                Sending…
                              </>
                            ) : (
                              <>
                                <MessageCircle className="h-4 w-4" aria-hidden />
                                Send to Messages
                              </>
                            )}
                          </Button>
                          {!active.support_conversation_id ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full"
                              onClick={openSupportThread}
                              disabled={threadPending || replyPending}
                            >
                              {threadPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                                  Linking…
                                </>
                              ) : (
                                "Open support thread"
                              )}
                            </Button>
                          ) : null}
                          {active.support_conversation_id ? (
                            <Button type="button" variant="secondary" size="sm" className="gap-1.5 rounded-full" asChild>
                              <Link href={`/admin/contact-messages/${active.id}`}>
                                <ExternalLink className="h-4 w-4" aria-hidden />
                                Open thread
                              </Link>
                            </Button>
                          ) : null}
                          {active.support_conversation_id ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="rounded-full text-muted-foreground"
                              onClick={() => copyText("Conversation ID", active.support_conversation_id!)}
                            >
                              Copy thread ID
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                      This visitor did not submit the form while logged in. An hourly job links tickets
                      when the email matches a member account — then inbox replies and Dashboard →
                      Support unlock. Until then, continue by email ({active.email}) or escalate
                      manually.
                    </div>
                  )}

                  {active.related_conversation_id ? (
                    <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Related marketplace chat
                      </p>
                      <p className="mt-1 font-mono text-xs text-foreground">{active.related_conversation_id}</p>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="mt-1 h-auto px-0 text-primary"
                        onClick={() => copyText("Conversation ID", active.related_conversation_id!)}
                      >
                        Copy ID
                      </Button>
                    </div>
                  ) : null}

                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Ticket body
                    </p>
                    <div className="rounded-2xl border border-border/80 bg-muted/15 p-4">
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{active.message}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1.5 rounded-full"
                      onClick={() => copyText("Ticket draft", buildContactTicketDraft(active))}
                    >
                      <ClipboardCopy className="h-4 w-4" />
                      Copy summary
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-full" asChild>
                      <Link href={ADMIN_SUPPORT_INBOX_ORDER_SUPPORT_HREF}>
                        <LifeBuoy className="h-4 w-4" />
                        Order support
                      </Link>
                    </Button>
                  </div>

                  <Separator className="bg-border/60" />

                  <div className="space-y-5 rounded-2xl border border-border/70 bg-muted/10 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="cm-status" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Workflow
                      </Label>
                      <p className="text-[13px] text-muted-foreground">
                        Members with a linked thread get an automatic message when this changes.
                      </p>
                      <Select
                        value={draftStatus}
                        onValueChange={(v) => setDraftStatus(v as ContactMessageSupportStatus)}
                      >
                        <SelectTrigger id="cm-status" className="rounded-xl">
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
                      <Label htmlFor="cm-notes" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Internal notes
                      </Label>
                      <Textarea
                        id="cm-notes"
                        value={draftNotes}
                        onChange={(e) => setDraftNotes(e.target.value)}
                        placeholder="Team-only context — never shown to the customer."
                        rows={5}
                        className="min-h-[120px] resize-y rounded-xl text-[15px]"
                      />
                    </div>
                  </div>
                </div>

                <SheetFooter className="mt-0 gap-3 border-t border-border/60 bg-muted/10 px-6 py-4 sm:flex-row sm:justify-between">
                  <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-sans text-foreground/70">Ticket · </span>
                    {active.id}
                  </p>
                  <Button type="button" className="rounded-full px-6" onClick={saveDetail} disabled={savePending}>
                    {savePending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Saving…
                      </>
                    ) : (
                      "Save changes"
                    )}
                  </Button>
                </SheetFooter>
              </>
            )}
          </SheetContent>
        </Sheet>
      </TabsContent>

      <TabsContent value="order-support" className="mt-0 outline-none">
        <OrderSupportRequestsPanel />
      </TabsContent>
    </Tabs>
  )
}
