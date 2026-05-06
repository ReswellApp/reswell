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
import { updateContactMessageAdminAction, ensureSupportTicketThreadAdminAction, sendSupportTicketAdminReplyAction } from "@/lib/actions/contactMessagesAdmin"
import { buildContactTicketDraft } from "@/lib/utils/contactMessageTicket"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  ClipboardCopy,
  ExternalLink,
  Inbox,
  LifeBuoy,
  Loader2,
  MessageCircle,
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

const STATUS_LABEL: Record<ContactMessageSupportStatus, string> = {
  new: "New",
  triaged: "Triaged",
  ticket_created: "In progress",
  resolved: "Resolved",
}

const CHANNEL_LABEL: Record<ContactMessageSource, string> = {
  contact_form: "Website",
  messages_support: "Messages",
}

function statusBadgeVariant(s: ContactMessageSupportStatus): "default" | "secondary" | "outline" {
  switch (s) {
    case "new":
      return "outline"
    case "triaged":
      return "secondary"
    case "ticket_created":
      return "default"
    case "resolved":
      return "outline"
    default:
      return "secondary"
  }
}

function channelBadgeVariant(s: ContactMessageSource): "default" | "secondary" | "outline" {
  return s === "messages_support" ? "default" : "secondary"
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
  const [search, setSearch] = useState("")
  const [statusFilterTab, setStatusFilterTab] = useState<"all" | ContactMessageSupportStatus>("all")
  const [channelTab, setChannelTab] = useState<"all" | ContactMessageSource>("all")
  const [active, setActive] = useState<ContactMessageRow | null>(null)
  const [draftStatus, setDraftStatus] = useState<ContactMessageSupportStatus>("new")
  const [draftNotes, setDraftNotes] = useState("")
  const [draftReply, setDraftReply] = useState("")
  const [savePending, startSaveTransition] = useTransition()
  const [replyPending, startReplyTransition] = useTransition()
  const [threadPending, startThreadTransition] = useTransition()
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
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
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!active) return
    setDraftStatus(active.support_status)
    setDraftNotes(active.internal_notes ?? "")
    setDraftReply("")
  }, [active])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilterTab !== "all" && r.support_status !== statusFilterTab) return false
      if (channelTab !== "all" && r.source !== channelTab) return false
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
  }, [rows, search, statusFilterTab, channelTab])

  const counts = useMemo(() => {
    const c = { new: 0, triaged: 0, ticket_created: 0, resolved: 0 }
    for (const r of rows) {
      c[r.support_status] += 1
    }
    return c
  }, [rows])

  const channelCounts = useMemo(() => {
    let website = 0
    let messages = 0
    for (const r of rows) {
      if (r.source === "messages_support") messages += 1
      else website += 1
    }
    return { website, messages }
  }, [rows])

  function copyText(label: string, text: string) {
    void navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Copy failed"),
    )
  }

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
      setRows((prev) =>
        prev.map((r) =>
          r.id === active.id
            ? {
                ...r,
                support_status: draftStatus,
                internal_notes: draftNotes,
                updated_at: new Date().toISOString(),
              }
            : r,
        ),
      )
      setActive((cur) =>
        cur && cur.id === active.id
          ? {
              ...cur,
              support_status: draftStatus,
              internal_notes: draftNotes,
              updated_at: new Date().toISOString(),
            }
          : cur,
      )
    })
  }

  return (
    <Tabs value={sectionTab} onValueChange={setSectionTab} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Support inbox</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Triage website contact and in-app Messages tickets. Replies in this drawer are posted to the member’s{" "}
            <strong>Messages</strong> thread from your configured support teammate; workflow changes still notify them
            automatically when a thread is linked.
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

      <TabsContent value="inbox" className="mt-0 space-y-8 outline-none">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardDescription>New</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{counts.new}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardDescription>Triaged</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{counts.triaged}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardDescription>In progress</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{counts.ticket_created}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardDescription>Resolved</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{counts.resolved}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardDescription>In-app Messages</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{channelCounts.messages}</CardTitle>
            </div>
            <MessageCircle className="h-8 w-8 text-muted-foreground/80" aria-hidden />
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Logged-in users — includes account ID and optional chat link when they filed from a thread.
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardDescription>Website</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{channelCounts.website}</CardTitle>
            </div>
            <Inbox className="h-8 w-8 text-muted-foreground/80" aria-hidden />
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Public contact page — name and email as entered.</CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/80">
        <CardHeader className="border-b border-border/60 bg-muted/15 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <Tabs
                value={statusFilterTab}
                onValueChange={(v) => setStatusFilterTab(v as "all" | ContactMessageSupportStatus)}
                className="w-full lg:w-auto"
              >
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1.5 p-1 sm:inline-flex sm:h-10 sm:w-auto">
                  <TabsTrigger value="all" className="text-xs sm:text-sm">
                    All ({rows.length})
                  </TabsTrigger>
                  {(Object.keys(STATUS_LABEL) as ContactMessageSupportStatus[]).map((k) => (
                    <TabsTrigger key={k} value={k} className="text-xs sm:text-sm">
                      {STATUS_LABEL[k]} ({counts[k]})
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="relative w-full lg:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, topic, or message…"
                  className="pl-9"
                  aria-label="Search support tickets"
                />
              </div>
            </div>
            <Tabs
              value={channelTab}
              onValueChange={(v) => setChannelTab(v as "all" | ContactMessageSource)}
              className="w-full"
            >
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1.5 bg-muted/40 p-1 sm:w-auto">
                <TabsTrigger value="all" className="text-xs sm:text-sm">
                  All channels
                </TabsTrigger>
                <TabsTrigger value="messages_support" className="gap-1.5 text-xs sm:text-sm">
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                  In-app ({channelCounts.messages})
                </TabsTrigger>
                <TabsTrigger value="contact_form" className="text-xs sm:text-sm">
                  Website ({channelCounts.website})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
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
                    <TableHead className="w-[104px]">Channel</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[140px]">Received</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead className="min-w-[200px]">Preview</TableHead>
                    <TableHead className="w-[1%] text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setActive(r)}>
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-primary"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActive(r)
                          }}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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
                      <strong>Messages</strong> like any other DM. Sending also links a thread if this ticket did not
                      have one yet.
                    </p>
                    {!active.support_conversation_id ? (
                      <p className="mt-2 text-sm text-amber-700 dark:text-amber-500/90">
                        No support thread linked yet. Send a reply below, or use &quot;Open support thread&quot; to link
                        the chat and post an intro.
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
                          <Link href={`/messages/${active.support_conversation_id}`}>
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
                    This visitor did not submit the form while logged in. There is no in-app Messages thread — continue
                    by email ({active.email}) or escalate manually.
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
                        {(Object.keys(STATUS_LABEL) as ContactMessageSupportStatus[]).map((k) => (
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
