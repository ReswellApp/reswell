"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  ArrowRight,
  Bot,
  GitBranch,
  Mail,
  Plus,
  Search,
  Send,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import {
  createEmailStudioFlowAction,
  openKlaviyoFlowAction,
} from "@/lib/actions/emailStudioFlows"
import type { EmailStudioRecord } from "@/lib/types/emailStudio"
import type {
  KlaviyoFlowWorkspaceItem,
  KlaviyoMetricWorkspaceItem,
} from "@/lib/types/emailStudioFlow"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmailStudioGenerate } from "@/components/features/admin/email-studio/email-studio-generate"
import { EmailStudioLibrary } from "@/components/features/admin/email-studio/email-studio-library"

function updatedLabel(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export function EmailStudioWorkspace({
  projects,
  templates,
  assistantEnabled,
  connected,
  flows,
  metrics,
  error,
}: {
  projects: EmailStudioRecord[]
  templates: EmailStudioRecord[]
  assistantEnabled: boolean
  connected: boolean
  flows: KlaviyoFlowWorkspaceItem[]
  metrics: KlaviyoMetricWorkspaceItem[]
  error: string | null
}) {
  const router = useRouter()
  const [tab, setTab] = useState<"flows" | "emails" | "metrics">("flows")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [flowName, setFlowName] = useState("")
  const [creating, setCreating] = useState(false)

  const filteredFlows = useMemo(() => flows.filter((flow) => {
    const matchesQuery = !query.trim()
      || `${flow.name} ${flow.triggerName}`.toLowerCase().includes(query.trim().toLowerCase())
    return matchesQuery && (status === "all" || flow.status === status)
  }), [flows, query, status])
  const liveCount = flows.filter((flow) => flow.status === "live").length
  const draftCount = flows.filter((flow) => flow.status === "draft").length

  async function openFlow(flow: KlaviyoFlowWorkspaceItem): Promise<void> {
    if (flow.localFlowId) {
      router.push(`/admin/email-studio/flows/${flow.localFlowId}`)
      return
    }
    if (flow.unsupportedActions.length > 0) {
      toast.error(`Not editable yet: ${flow.unsupportedActions.join(", ")}`)
      return
    }
    setOpeningId(flow.id)
    const result = await openKlaviyoFlowAction({ klaviyoFlowId: flow.id })
    setOpeningId(null)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    if (result.imported) toast.success("Flow imported from Klaviyo")
    router.push(`/admin/email-studio/flows/${result.flowId}`)
  }

  async function createFlow(): Promise<void> {
    const name = flowName.trim()
    if (!name) {
      toast.error("Name the flow")
      return
    }
    setCreating(true)
    const result = await createEmailStudioFlowAction({ name })
    setCreating(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    router.push(`/admin/email-studio/flows/${result.data.id}`)
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "All flows", value: flows.length, icon: GitBranch },
          { label: "Live", value: liveCount, icon: Send },
          { label: "Draft", value: draftCount, icon: Mail },
          { label: "Metrics", value: metrics.length, icon: Activity },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon className="h-4 w-4 text-[#5574AD]" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          </div>
        ))}
      </section>

      {!connected || error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error || "Connect Klaviyo to load flows and metrics."}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-3">
          <div className="flex rounded-lg bg-muted p-1">
            {([
              ["flows", "Flows"],
              ["emails", "Emails"],
              ["metrics", "Metrics"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium",
                  tab === value ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
                onClick={() => {
                  setTab(value)
                  setQuery("")
                  setShowCreate(false)
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {tab !== "emails" ? (
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                className="h-9 pl-9"
                placeholder={`Search ${tab}`}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          ) : <div className="flex-1" />}
          {tab === "flows" ? (
            <select
              value={status}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs"
              aria-label="Flow status"
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="live">Live</option>
              <option value="manual">Manual</option>
              <option value="draft">Draft</option>
            </select>
          ) : null}
          {tab !== "metrics" ? (
            <Button size="sm" variant="outline" onClick={() => setShowGenerate((value) => !value)}>
              <Bot className="h-3.5 w-3.5" />
              Ask AI
            </Button>
          ) : null}
          {tab === "flows" ? (
            <Button size="sm" onClick={() => setShowCreate((value) => !value)}>
              <Plus className="h-3.5 w-3.5" />
              Create flow
            </Button>
          ) : null}
        </div>

        {showGenerate && tab !== "metrics" ? (
          <div className="border-b border-border p-3">
            <EmailStudioGenerate target={tab === "flows" ? "flow" : "email"} enabled={assistantEnabled} />
          </div>
        ) : null}
        {showCreate && tab === "flows" ? (
          <div className="flex flex-wrap gap-2 border-b border-border bg-muted/30 p-3">
            <Input
              value={flowName}
              className="max-w-sm"
              placeholder="Abandoned checkout"
              aria-label="Flow name"
              onChange={(event) => setFlowName(event.target.value)}
            />
            <Button disabled={creating} onClick={() => void createFlow()}>
              {creating ? "Creating…" : "Open flow canvas"}
            </Button>
          </div>
        ) : null}

        {tab === "flows" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Flow</th>
                  <th className="px-4 py-2.5 font-medium">Trigger</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Actions</th>
                  <th className="px-4 py-2.5 font-medium">Last updated</th>
                  <th className="w-32 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredFlows.map((flow) => (
                  <tr key={flow.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <button type="button" className="text-left" onClick={() => void openFlow(flow)}>
                        <span className="block text-sm font-medium">{flow.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {flow.localFlowId ? "Studio connected" : "Klaviyo"}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs">
                        <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                        {flow.triggerName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "rounded-full px-2 py-1 text-[10px] font-medium capitalize",
                        flow.status === "live"
                          ? "bg-emerald-100 text-emerald-700"
                          : flow.status === "manual"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600",
                      )}>
                        {flow.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {flow.actionCount} actions · {flow.emailCount} emails
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {updatedLabel(flow.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={openingId === flow.id || flow.unsupportedActions.length > 0}
                        title={flow.unsupportedActions.length ? `Unsupported: ${flow.unsupportedActions.join(", ")}` : undefined}
                        onClick={() => void openFlow(flow)}
                      >
                        {openingId === flow.id ? "Importing…" : flow.localFlowId ? "Open" : "Import & open"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredFlows.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No flows match these filters.</p>
            ) : null}
          </div>
        ) : tab === "metrics" ? (
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {metrics
              .filter((metric) => !query.trim() || metric.name.toLowerCase().includes(query.toLowerCase()))
              .map((metric) => (
                <div key={metric.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{metric.name}</span>
                    <Activity className="h-4 w-4 text-[#5574AD]" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.flowCount} connected flows</p>
                  <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground">{metric.id}</p>
                </div>
              ))}
          </div>
        ) : (
          <div className="p-4">
            <EmailStudioLibrary
              projects={projects}
              templates={templates}
              assistantEnabled={assistantEnabled}
            />
          </div>
        )}
      </section>
    </div>
  )
}
