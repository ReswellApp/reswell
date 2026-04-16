"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { ContactMessageRow, ContactMessageSupportStatus } from "@/lib/db/contactMessages"
import { updateContactMessageAdminAction } from "@/lib/actions/contactMessagesAdmin"
import { buildContactReplyMailto, buildContactTicketDraft } from "@/lib/utils/contactMessageTicket"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClipboardCopy, ExternalLink, Inbox, LifeBuoy, Loader2, Mail, Search } from "lucide-react"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

const SELECT =
  "id, name, email, message, created_at, support_status, ticket_url, internal_notes, updated_at"

const STATUS_LABEL: Record<ContactMessageSupportStatus, string> = {
  new: "New",
  triaged: "Triaged",
  ticket_created: "Ticket linked",
  resolved: "Resolved",
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

export function ContactMessagesAdminClient() {
  const [rows, setRows] = useState<ContactMessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<"all" | ContactMessageSupportStatus>("all")
  const [active, setActive] = useState<ContactMessageRow | null>(null)
  const [draftStatus, setDraftStatus] = useState<ContactMessageSupportStatus>("new")
  const [draftTicketUrl, setDraftTicketUrl] = useState("")
  const [draftNotes, setDraftNotes] = useState("")
  const [pending, startTransition] = useTransition()
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
      toast.error("Could not load messages. If this persists, run the latest database migration.")
      setRows([])
    } else {
      setRows((data ?? []) as ContactMessageRow[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!active) return
    setDraftStatus(active.support_status)
    setDraftTicketUrl(active.ticket_url ?? "")
    setDraftNotes(active.internal_notes ?? "")
  }, [active])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (tab !== "all" && r.support_status !== tab) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q)
      )
    })
  }, [rows, search, tab])

  const counts = useMemo(() => {
    const c = { new: 0, triaged: 0, ticket_created: 0, resolved: 0 }
    for (const r of rows) {
      c[r.support_status] += 1
    }
    return c
  }, [rows])

  function copyText(label: string, text: string) {
    void navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Copy failed"),
    )
  }

  function saveDetail() {
    if (!active) return
    startTransition(async () => {
      const res = await updateContactMessageAdminAction({
        id: active.id,
        support_status: draftStatus,
        ticket_url: draftTicketUrl,
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
                ticket_url: draftTicketUrl.trim() === "" ? null : draftTicketUrl.trim(),
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
              ticket_url: draftTicketUrl.trim() === "" ? null : draftTicketUrl.trim(),
              internal_notes: draftNotes,
              updated_at: new Date().toISOString(),
            }
          : cur,
      )
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Contact messages</h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Triage inbound mail from the public contact form. Open a row to copy a ticket-ready summary, link your
            tracker issue, and keep internal notes. Pair with{" "}
            <Link
              href="/admin/order-support"
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/90"
            >
              Order support
            </Link>{" "}
            for purchase-related threads.
          </p>
        </div>
      </div>

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
            <CardDescription>Ticket linked</CardDescription>
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

      <Card className="overflow-hidden border-border/80">
        <CardHeader className="border-b border-border/60 bg-muted/15 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as "all" | ContactMessageSupportStatus)}
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
                placeholder="Search name, email, or message…"
                className="pl-9"
                aria-label="Search contact messages"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading messages…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Inbox className="h-10 w-10 opacity-50" />
              <p className="text-sm">
                {rows.length === 0 ? "No contact messages yet." : "No messages match this filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[140px]">Received</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead className="min-w-[200px]">Preview</TableHead>
                    <TableHead className="w-[1%] text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => setActive(r)}
                    >
                      <TableCell>
                        <Badge
                          variant={statusBadgeVariant(r.support_status)}
                          className={cn(
                            "font-normal",
                            r.support_status === "resolved" && "border-transparent bg-muted text-muted-foreground",
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
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
          {active && (
            <>
              <SheetHeader className="space-y-1 text-left">
                <SheetTitle className="pr-8 text-xl">Message detail</SheetTitle>
                <SheetDescription>
                  {format(new Date(active.created_at), "PPpp")} ·{" "}
                  {formatDistanceToNow(new Date(active.created_at), { addSuffix: true })}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-2 space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{active.name}</p>
                  <a href={`mailto:${active.email}`} className="text-sm text-primary hover:underline">
                    {active.email}
                  </a>
                </div>

                <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{active.message}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => copyText("Ticket draft", buildContactTicketDraft(active))}
                  >
                    <ClipboardCopy className="h-4 w-4" />
                    Copy ticket draft
                  </Button>
                  <Button type="button" variant="secondary" size="sm" className="gap-1.5" asChild>
                    <a href={buildContactReplyMailto(active)}>
                      <Mail className="h-4 w-4" />
                      Reply in email
                    </a>
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
                    <Link href="/admin/order-support">
                      <LifeBuoy className="h-4 w-4" />
                      Order support
                    </Link>
                  </Button>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cm-status">Workflow</Label>
                    <Select
                      value={draftStatus}
                      onValueChange={(v) => setDraftStatus(v as ContactMessageSupportStatus)}
                    >
                      <SelectTrigger id="cm-status">
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
                    <Label htmlFor="cm-ticket">Ticket URL</Label>
                    <Input
                      id="cm-ticket"
                      value={draftTicketUrl}
                      onChange={(e) => setDraftTicketUrl(e.target.value)}
                      placeholder="https://linear.app/… or your tracker link"
                      inputMode="url"
                      autoComplete="off"
                    />
                    {draftTicketUrl.trim() !== "" && (
                      <Button variant="link" size="sm" className="h-auto px-0 text-primary" asChild>
                        <a href={draftTicketUrl.trim()} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-1 inline h-3.5 w-3.5" />
                          Open ticket
                        </a>
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cm-notes">Internal notes</Label>
                    <Textarea
                      id="cm-notes"
                      value={draftNotes}
                      onChange={(e) => setDraftNotes(e.target.value)}
                      placeholder="Context for the team — not visible to the customer."
                      rows={4}
                      className="resize-y min-h-[100px]"
                    />
                  </div>
                </div>
              </div>

              <SheetFooter className="mt-auto gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-between">
                <p className="text-[11px] text-muted-foreground sm:max-w-[55%]">
                  ID <span className="font-mono">{active.id}</span>
                </p>
                <Button type="button" onClick={saveDetail} disabled={pending}>
                  {pending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
