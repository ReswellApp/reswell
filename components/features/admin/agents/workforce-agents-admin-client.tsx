"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Bot, Loader2, Play } from "lucide-react"
import { toast } from "sonner"

import {
  runWorkforceAgentAction,
  toggleWorkforceAgentAction,
} from "@/lib/actions/workforceAgentActions"
import { WORKFORCE_CATEGORY_LABELS } from "@/lib/workforce-agents/catalog"
import type {
  WorkforceAgentAdminView,
  WorkforceAgentCategory,
} from "@/lib/workforce-agents/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

const CATEGORY_ORDER: WorkforceAgentCategory[] = [
  "supply",
  "demand",
  "ads",
  "ops",
  "trust",
  "finance",
]

function statusBadge(status: WorkforceAgentAdminView["lastRunStatus"]) {
  switch (status) {
    case "ok":
      return <Badge variant="secondary">Last run ok</Badge>
    case "error":
      return <Badge variant="destructive">Last run error</Badge>
    case "skipped":
      return <Badge variant="outline">Skipped</Badge>
    default:
      return <Badge variant="outline">Never run</Badge>
  }
}

function formatWhen(value: string | null): string {
  if (!value) return "—"
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function AgentRow({ agent }: { agent: WorkforceAgentAdminView }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pendingToggle, startToggle] = useTransition()
  const [pendingRun, startRun] = useTransition()

  function onToggle(enabled: boolean) {
    startToggle(async () => {
      const result = await toggleWorkforceAgentAction({ agentId: agent.id, enabled })
      if ("error" in result && result.error) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      setError(null)
      toast.success(`${agent.name} ${enabled ? "on" : "off"}`)
      router.refresh()
    })
  }

  function onRun() {
    startRun(async () => {
      const result = await runWorkforceAgentAction({ agentId: agent.id })
      if ("error" in result && result.error) {
        setError(result.error)
        toast.error(result.error)
        router.refresh()
        return
      }
      setError(null)
      const summary =
        "summary" in result && typeof result.summary === "string"
          ? result.summary
          : `${agent.name} finished`
      if ("status" in result && result.status === "error") {
        setError(summary)
        toast.error(summary)
      } else {
        toast.success(summary)
      }
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
            {agent.mode === "assist" ? (
              <Badge variant="outline">Assist</Badge>
            ) : (
              <Badge variant="secondary">Auto</Badge>
            )}
            {agent.recommended ? <Badge variant="outline">Recommended</Badge> : null}
            {statusBadge(agent.lastRunStatus)}
          </div>
          <p className="text-sm text-muted-foreground">{agent.shortDescription}</p>
          <p className="text-xs text-muted-foreground">
            Cadence: {agent.cadence}
            {agent.lastRunAt ? ` · Last run ${formatWhen(agent.lastRunAt)} PT` : ""}
          </p>
          {agent.lastRunSummary ? (
            <p className="text-xs text-foreground/80 line-clamp-2">{agent.lastRunSummary}</p>
          ) : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-3 self-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!agent.enabled || pendingRun || pendingToggle}
            onClick={onRun}
            className="gap-1.5"
          >
            {pendingRun ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden />
            )}
            Run now
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <span className={cn("tabular-nums", agent.enabled ? "text-foreground" : "text-muted-foreground")}>
              {agent.enabled ? "On" : "Off"}
            </span>
            <Switch
              checked={agent.enabled}
              disabled={pendingToggle || pendingRun}
              onCheckedChange={onToggle}
              aria-label={`Turn ${agent.name} ${agent.enabled ? "off" : "on"}`}
            />
          </label>
        </div>
      </div>
    </div>
  )
}

export function WorkforceAgentsAdminClient({
  agents,
}: {
  agents: WorkforceAgentAdminView[]
}) {
  const enabledCount = agents.filter((agent) => agent.enabled).length

  const grouped = useMemo(() => {
    const map = new Map<WorkforceAgentCategory, WorkforceAgentAdminView[]>()
    for (const category of CATEGORY_ORDER) map.set(category, [])
    for (const agent of agents) {
      const list = map.get(agent.category) ?? []
      list.push(agent)
      map.set(agent.category, list)
    }
    return CATEGORY_ORDER.map((category) => ({
      category,
      label: WORKFORCE_CATEGORY_LABELS[category],
      agents: map.get(category) ?? [],
    })).filter((group) => group.agents.length > 0)
  }, [agents])

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex gap-3">
          <div className="mt-0.5 rounded-md border border-border bg-background p-2">
            <Bot className="h-5 w-5 text-foreground" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {enabledCount} of {agents.length} agents on
            </p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Toggle agents on to include them in the daily cron. Assist agents draft work for you
              (email / FB) — they do not auto-message Marketplace. Use Run now to execute an
              enabled agent immediately.
            </p>
          </div>
        </div>
      </div>

      {grouped.map((group) => (
        <section key={group.category} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h2>
          <div className="space-y-3">
            {group.agents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
