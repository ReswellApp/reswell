"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ArrowLeft, ChevronDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
import {
  hasOpsSignalDetails,
  opsGroupLevel,
  opsGroupMethod,
  opsGroupSampleRequestIds,
  opsGroupStatusCode,
  opsSignalLevel,
  opsSignalMethod,
  opsSignalOccurrenceCount,
  opsSignalSampleRequestIds,
  opsSignalStatusCode,
} from "@/lib/utils/opsDisplay"
import { cn } from "@/lib/utils"

interface OpsGroupDetailClientProps {
  groupId: string
}

function MetaChip({
  label,
  value,
  mono,
  emphasis,
}: {
  label: string
  value: string
  mono?: boolean
  emphasis?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        emphasis ? "border-red-200 bg-red-50" : "border-border/70 bg-muted/30",
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm",
          mono && "font-mono text-xs break-all",
          emphasis && "font-semibold tabular-nums text-red-800",
        )}
      >
        {value}
      </p>
    </div>
  )
}

function SignalDetails({ signal }: { signal: OpsSignalRow }) {
  const [open, setOpen] = useState(false)
  const statusCode = opsSignalStatusCode(signal)
  const method = opsSignalMethod(signal)
  const level = opsSignalLevel(signal)
  const requestIds = opsSignalSampleRequestIds(signal)
  const occurrenceCount = opsSignalOccurrenceCount(signal)
  const hasDetails = hasOpsSignalDetails(signal)

  return (
    <li className="rounded-md border p-3 text-xs">
      <div className="flex flex-wrap justify-between gap-2 text-muted-foreground">
        <span>
          {formatDistanceToNow(new Date(signal.occurred_at), { addSuffix: true })}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {statusCode ? (
            <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono font-semibold text-red-800">
              {statusCode}
            </span>
          ) : null}
          {method ? <span className="font-mono uppercase">{method}</span> : null}
          {level ? <span className="capitalize">{level}</span> : null}
          {occurrenceCount != null ? (
            <span className="tabular-nums">{occurrenceCount}×</span>
          ) : null}
          <span className="font-mono">{signal.external_id ?? signal.id.slice(0, 8)}</span>
        </div>
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
      {requestIds.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {requestIds.map((id) => (
            <span
              key={id}
              className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700"
            >
              {id}
            </span>
          ))}
        </div>
      ) : null}
      {hasDetails ? (
        <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              {open ? "Hide" : "Show"} payload
              <ChevronDown
                className={cn("ml-1 h-3.5 w-3.5 transition-transform", open && "rotate-180")}
                aria-hidden
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
              {JSON.stringify(signal.payload ?? {}, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </li>
  )
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

  const statusCode = opsGroupStatusCode(group)
  const method = opsGroupMethod(group)
  const level = opsGroupLevel(group)
  const sampleRequestIds = opsGroupSampleRequestIds(group)
  const vercelSource = typeof group.metadata?.vercel_source === "string"
    ? group.metadata.vercel_source
    : null

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
        {statusCode ? (
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-red-800 ring-1 ring-inset ring-red-100">
            HTTP {statusCode}
          </span>
        ) : null}
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

          <div>
            <h3 className="mb-2 text-sm font-medium">Error codes & context</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {statusCode ? (
                <MetaChip label="Status code" value={statusCode} mono emphasis />
              ) : null}
              {method ? <MetaChip label="Method" value={method} mono /> : null}
              {level ? <MetaChip label="Level" value={level} /> : null}
              {group.category ? <MetaChip label="Category" value={group.category} /> : null}
              {group.environment ? (
                <MetaChip label="Environment" value={group.environment} />
              ) : null}
              {vercelSource ? <MetaChip label="Vercel source" value={vercelSource} /> : null}
              {group.path ? <MetaChip label="Path" value={group.path} mono /> : null}
              {group.last_url ? <MetaChip label="Last URL" value={group.last_url} mono /> : null}
              {group.release ? <MetaChip label="Release" value={group.release} mono /> : null}
              <MetaChip
                label="First seen"
                value={formatDistanceToNow(new Date(group.first_seen_at), { addSuffix: true })}
              />
              <MetaChip
                label="Last seen"
                value={formatDistanceToNow(new Date(group.last_seen_at), { addSuffix: true })}
              />
            </div>
            {sampleRequestIds.length > 0 ? (
              <div className="mt-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Sample request IDs
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {sampleRequestIds.map((id) => (
                    <span
                      key={id}
                      className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-800"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Log / error message</h3>
            {group.message ? (
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-[12px] leading-relaxed">
                {group.message}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">No log message stored for this issue.</p>
            )}
          </div>

          {group.stack_sample ? (
            <div>
              <h3 className="mb-2 text-sm font-medium">Stack sample</h3>
              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
                {group.stack_sample}
              </pre>
            </div>
          ) : null}

          {Object.keys(group.metadata ?? {}).length > 0 ? (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  Raw metadata
                  <ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
                  {JSON.stringify(group.metadata, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
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
          <CardDescription>
            Individual occurrences with status codes, request IDs, and raw payloads
          </CardDescription>
        </CardHeader>
        <CardContent>
          {signals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No signals stored for this group.</p>
          ) : (
            <ul className="space-y-3">
              {signals.map((signal) => (
                <SignalDetails key={signal.id} signal={signal} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
