"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  createOpsFixTicketAction,
  updateOpsFixTicketAction,
  updateOpsGroupStatusAction,
} from "@/lib/actions/opsAdmin"
import { createClient } from "@/lib/supabase/client"
import {
  OPS_GROUP_LIST_SELECT,
  OPS_SIGNAL_LIST_SELECT,
  OPS_TICKET_LIST_SELECT,
  type OpsFixTicketRow,
  type OpsGroupRow,
  type OpsGroupStatus,
  type OpsSignalRow,
  type OpsTicketStatus,
} from "@/lib/types/ops"

interface OpsGroupDetailClientProps {
  groupId: string
}

export function OpsGroupDetailClient({ groupId }: OpsGroupDetailClientProps) {
  const supabase = createClient()
  const [group, setGroup] = useState<OpsGroupRow | null>(null)
  const [signals, setSignals] = useState<OpsSignalRow[]>([])
  const [tickets, setTickets] = useState<OpsFixTicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const [ticketTitle, setTicketTitle] = useState("")
  const [ticketNotes, setTicketNotes] = useState("")
  const [ticketPriority, setTicketPriority] = useState<"low" | "medium" | "high" | "urgent">(
    "medium",
  )

  const load = useCallback(async () => {
    setLoading(true)
    const [groupRes, signalsRes, ticketsRes] = await Promise.all([
      supabase.from("ops_groups").select(OPS_GROUP_LIST_SELECT).eq("id", groupId).maybeSingle(),
      supabase
        .from("ops_signals")
        .select(OPS_SIGNAL_LIST_SELECT)
        .eq("group_id", groupId)
        .order("occurred_at", { ascending: false })
        .limit(75),
      supabase
        .from("ops_fix_tickets")
        .select(OPS_TICKET_LIST_SELECT)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }),
    ])
    setLoading(false)

    if (groupRes.error || !groupRes.data) {
      toast.error(groupRes.error?.message ?? "Group not found")
      setGroup(null)
      return
    }

    const g = groupRes.data as OpsGroupRow
    setGroup(g)
    setSignals((signalsRes.data ?? []) as OpsSignalRow[])
    setTickets((ticketsRes.data ?? []) as OpsFixTicketRow[])
    setTicketTitle((prev) =>
      prev.trim() ? prev : `Fix: ${g.reference_code} — ${g.title}`.slice(0, 200),
    )
  }, [supabase, groupId])

  useEffect(() => {
    void load()
  }, [load])

  const setStatus = (status: OpsGroupStatus) => {
    startTransition(async () => {
      const result = await updateOpsGroupStatusAction({ groupId, status })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setGroup(result.data)
      toast.success(`Marked ${status}`)
    })
  }

  const createTicket = () => {
    startTransition(async () => {
      const result = await createOpsFixTicketAction({
        groupId,
        title: ticketTitle,
        notes: ticketNotes,
        priority: ticketPriority,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Fix ticket created")
      setTicketNotes("")
      void load()
    })
  }

  const setTicketStatus = (ticketId: string, status: OpsTicketStatus) => {
    startTransition(async () => {
      const result = await updateOpsFixTicketAction({ ticketId, status })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? result.data : t)))
      toast.success(`Ticket ${status}`)
    })
  }

  if (loading && !group) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading…
      </div>
    )
  }

  if (!group) {
    return (
      <div className="space-y-4 p-6">
        <Button variant="ghost" asChild>
          <Link href="/admin/ops">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Back
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Group not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/ops">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            All issues
          </Link>
        </Button>
        <span className="font-mono text-sm text-muted-foreground">{group.reference_code}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{group.title}</CardTitle>
          <CardDescription>
            {group.source} · {group.severity} · {group.occurrence_count} occurrence
            {group.occurrence_count === 1 ? "" : "s"} · last{" "}
            {formatDistanceToNow(new Date(group.last_seen_at), { addSuffix: true })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["open", "acknowledged", "resolved", "ignored"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={group.status === s ? "default" : "outline"}
                disabled={pending || group.status === s}
                onClick={() => setStatus(s)}
                className="capitalize"
              >
                {s}
              </Button>
            ))}
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Path</dt>
              <dd className="font-mono text-xs">{group.path ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Environment</dt>
              <dd>{group.environment ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Message</dt>
              <dd className="whitespace-pre-wrap break-words">{group.message || "—"}</dd>
            </div>
            {group.stack_sample ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Stack sample</dt>
                <dd>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
                    {group.stack_sample}
                  </pre>
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create fix ticket</CardTitle>
          <CardDescription>Internal eng/ops ticket linked to this group</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={ticketTitle}
            onChange={(e) => setTicketTitle(e.target.value)}
            placeholder="Ticket title"
          />
          <Textarea
            value={ticketNotes}
            onChange={(e) => setTicketNotes(e.target.value)}
            placeholder="Notes / repro / owner…"
            rows={3}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={ticketPriority}
              onValueChange={(v) => setTicketPriority(v as typeof ticketPriority)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["low", "medium", "high", "urgent"] as const).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={pending || ticketTitle.trim().length < 2} onClick={createTicket}>
              Create ticket
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fix tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tickets yet.</p>
          ) : (
            <ul className="space-y-3">
              {tickets.map((ticket) => (
                <li key={ticket.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{ticket.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {ticket.priority} · {ticket.status}
                      </p>
                      {ticket.notes ? (
                        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                          {ticket.notes}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(["open", "in_progress", "done"] as const).map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={ticket.status === s ? "default" : "outline"}
                          disabled={pending || ticket.status === s}
                          onClick={() => setTicketStatus(ticket.id, s)}
                          className="capitalize text-xs"
                        >
                          {s.replace("_", " ")}
                        </Button>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent signals</CardTitle>
          <CardDescription>Individual occurrences / log samples</CardDescription>
        </CardHeader>
        <CardContent>
          {signals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No signals stored for this group.</p>
          ) : (
            <ul className="space-y-3">
              {signals.map((signal) => (
                <li key={signal.id} className="rounded-md border p-3 text-xs">
                  <div className="flex flex-wrap justify-between gap-2 text-muted-foreground">
                    <span>
                      {formatDistanceToNow(new Date(signal.occurred_at), { addSuffix: true })}
                    </span>
                    <span className="font-mono">{signal.external_id ?? signal.id.slice(0, 8)}</span>
                  </div>
                  {signal.url ? <p className="mt-1 font-mono">{signal.url}</p> : null}
                  {signal.user_id ? (
                    <p className="mt-1">
                      User{" "}
                      <Link
                        href={`/admin/users/${signal.user_id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {signal.user_id.slice(0, 8)}…
                      </Link>
                    </p>
                  ) : null}
                  {signal.digest ? <p className="mt-1">Digest: {signal.digest}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
