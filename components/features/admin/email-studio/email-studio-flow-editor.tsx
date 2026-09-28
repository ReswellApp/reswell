"use client"

import { useEffect, useMemo, useState } from "react"
import type { MouseEvent as ReactMouseEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Redo2, Undo2 } from "lucide-react"
import { toast } from "sonner"
import {
  pushEmailStudioFlowAction,
  setEmailStudioFlowStatusAction,
} from "@/lib/actions/emailStudioFlows"
import { klaviyoFromEmail, klaviyoFromLabel } from "@/lib/email-studio/flow-definition"
import type {
  EmailStudioAssistantProposalPreview,
  EmailStudioFlowSnapshot,
} from "@/lib/types/emailStudioCommands"
import type { EmailStudioFlowRecord, EmailStudioFlowStep, EmailStudioMessage, KlaviyoCatalogOption } from "@/lib/types/emailStudioFlow"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmailStudioAssistant } from "@/components/features/admin/email-studio/email-studio-assistant"
import { EmailStudioFlowCanvas } from "@/components/features/admin/email-studio/email-studio-flow-canvas"
import { EmailStudioFlowStepInspector } from "@/components/features/admin/email-studio/email-studio-flow-steps"
import { EmailStudioVersionHistory } from "@/components/features/admin/email-studio/email-studio-version-history"
import { useEmailStudioFlow } from "@/components/features/admin/email-studio/hooks/use-email-studio-flow"

const selectClass = "h-10 rounded-md border border-input bg-background px-3 text-sm"

function newStep(type: EmailStudioFlowStep["type"]): EmailStudioFlowStep {
  const id = crypto.randomUUID()
  if (type === "delay") return { id, type, unit: "hours", value: 1, next: null }
  if (type === "email") {
    return { id, type, projectId: "", fromEmail: klaviyoFromEmail(), fromLabel: klaviyoFromLabel(), smartSending: true, transactional: false, next: null }
  }
  if (type === "sms") return { id, type, body: "", smartSending: true, next: null }
  if (type === "webhook") return { id, type, url: "", body: "", next: null }
  if (type === "update-profile") return { id, type, property: "", value: "", next: null }
  if (type === "list-update") return { id, type, listId: "", add: true, next: null }
  return { id, type: "split", mode: "email-subscribed", property: "", operator: "equals", value: "", yes: null, no: null }
}

export function EmailStudioFlowEditor({
  flow,
  projects,
  hasStaleLinkedEmails,
  metrics,
  lists,
  segments,
  klaviyoConnected,
  assistantEnabled,
  messages,
  pendingProposal,
}: {
  flow: EmailStudioFlowRecord
  projects: { id: string; name: string }[]
  hasStaleLinkedEmails: boolean
  metrics: KlaviyoCatalogOption[]
  lists: KlaviyoCatalogOption[]
  segments: KlaviyoCatalogOption[]
  klaviyoConnected: boolean
  assistantEnabled: boolean
  messages: EmailStudioMessage[]
  pendingProposal: Extract<EmailStudioAssistantProposalPreview, { scope: "flow" }> | null
}) {
  const router = useRouter()
  const {
    draft,
    change,
    patchDefinition: commitDefinition,
    save,
    dirty,
    saving,
    saveError,
    conflict,
    undo,
    redo,
    canUndo,
    canRedo,
    getCurrent,
    mergeServerFields,
    reset,
  } = useEmailStudioFlow(flow)
  const [selectedId, setSelectedId] = useState<string | null>(
    pendingProposal?.flow.definition.steps[0]?.id ?? flow.definition.steps[0]?.id ?? null,
  )
  const [confirmLive, setConfirmLive] = useState(false)
  const [proposalPreview, setProposalPreview] = useState<EmailStudioFlowSnapshot | null>(
    pendingProposal?.flow ?? null,
  )
  const displayDraft = proposalPreview ? { ...draft, ...proposalPreview } : draft
  const snapshot = useMemo(() => JSON.stringify({ name: draft.name, definition: draft.definition }), [draft])

  function patchDefinition(definition: EmailStudioFlowRecord["definition"]): void {
    if (proposalPreview) return
    commitDefinition(definition)
  }

  function add(type: EmailStudioFlowStep["type"]) {
    if (proposalPreview) return
    const step = newStep(type)
    const steps = [...draft.definition.steps]
    const entry = draft.definition.entryStepId
    if (!entry) {
      patchDefinition({ ...draft.definition, entryStepId: step.id, steps: [...steps, step] })
    } else {
      const selected = steps.find((item) => item.id === selectedId)
      if (!selected) {
        toast.error("Select the action this should follow.")
        return
      }
      if (selected.type === "split") {
        if (!selected.yes) {
          patchDefinition({
            ...draft.definition,
            steps: [...steps.map((item) => item.id === selected.id ? { ...selected, yes: step.id } : item), step],
          })
        } else if (!selected.no) {
          patchDefinition({
            ...draft.definition,
            steps: [...steps.map((item) => item.id === selected.id ? { ...selected, no: step.id } : item), step],
          })
        } else {
          toast.error("Select the last action on the branch where this should go.")
          return
        }
      } else {
        const inserted = { ...step, next: selected.next } as EmailStudioFlowStep
        patchDefinition({
          ...draft.definition,
          steps: [
            ...steps.map((item) => item.id === selected.id ? { ...selected, next: step.id } : item),
            inserted,
          ],
        })
      }
    }
    setSelectedId(step.id)
  }

  function removeSelected(): void {
    if (!selectedId || proposalPreview) return
    const selected = draft.definition.steps.find((step) => step.id === selectedId)
    if (!selected) return
    if (selected.type === "split" && (selected.yes || selected.no)) {
      toast.error("Disconnect both split paths before removing this split.")
      return
    }
    const continuation = selected.type === "split" ? null : selected.next
    const steps = draft.definition.steps
      .filter((step) => step.id !== selected.id)
      .map((step) => {
        if (step.type === "split") {
          return {
            ...step,
            yes: step.yes === selected.id ? continuation : step.yes,
            no: step.no === selected.id ? continuation : step.no,
          }
        }
        return { ...step, next: step.next === selected.id ? continuation : step.next }
      })
    patchDefinition({
      ...draft.definition,
      entryStepId: draft.definition.entryStepId === selected.id
        ? continuation
        : draft.definition.entryStepId,
      steps,
    })
    setSelectedId(continuation ?? steps[0]?.id ?? null)
  }

  async function push(replace: boolean) {
    const ok = await save({ flush: true })
    if (!ok) return
    const result = await pushEmailStudioFlowAction({ id: draft.id, replace })
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    mergeServerFields({
      klaviyoFlowId: result.klaviyoFlowId,
      klaviyoStatus: "draft",
      klaviyoSyncedRevision: result.syncedRevision,
      klaviyoContentChecksum: result.checksum,
      klaviyoSyncedAt: result.syncedAt,
      klaviyoReplacedFlowId: result.replacedId
        ? draft.klaviyoReplacedFlowId ?? result.replacedId
        : draft.klaviyoReplacedFlowId,
      klaviyoReplacedFlowStatus: result.replacedId
        ? draft.klaviyoReplacedFlowStatus ?? draft.klaviyoStatus
        : draft.klaviyoReplacedFlowStatus,
    })
    if (result.warning) toast.warning(result.warning)
    else toast.success(result.replacedId ? "New Klaviyo draft created. The previous flow is still in Klaviyo." : "Draft flow is verified in Klaviyo. It is not sending.")
    router.refresh()
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault()
        void save({ announce: true, flush: true })
        return
      }
      const target = event.target as HTMLElement | null
      if (!mod || target?.matches("input, textarea, [contenteditable='true']")) return
      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey)) {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const trigger = displayDraft.definition.trigger
  const selected = displayDraft.definition.steps.find((step) => step.id === selectedId) ?? null
  const flowStructureStale = Boolean(
    draft.klaviyoFlowId
    && (dirty || draft.klaviyoSyncedRevision !== draft.revision),
  )
  const klaviyoStale = flowStructureStale || hasStaleLinkedEmails

  async function setStatus(status: "draft" | "manual" | "live"): Promise<void> {
    const result = await setEmailStudioFlowStatusAction({
      id: draft.id,
      status,
      confirmLive: status === "live",
    })
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    mergeServerFields({
      klaviyoStatus: status,
      klaviyoReplacedFlowId: status === "live" ? null : draft.klaviyoReplacedFlowId,
      klaviyoReplacedFlowStatus: status === "live" ? null : draft.klaviyoReplacedFlowStatus,
    })
    toast.success(status === "live" ? "Flow is live" : `Set to ${status}`)
  }

  function navigateAfterSave(event: ReactMouseEvent<HTMLAnchorElement>, href: string): void {
    if (!dirty) return
    event.preventDefault()
    void save({ flush: true }).then((saved) => {
      if (saved) router.push(href)
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/email-studio/flows" onClick={(event) => navigateAfterSave(event, "/admin/email-studio/flows")}>Flows</Link>
        </Button>
        <Input
          value={displayDraft.name}
          aria-label="Flow name"
          disabled={Boolean(proposalPreview)}
          className="h-9 max-w-xs"
          onChange={(event) => change({ name: event.target.value })}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span
            className={conflict || saveError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
            title={saveError ?? undefined}
          >
            {conflict
              ? "Save conflict"
              : saving
                ? "Saving…"
                : saveError
                  ? "Autosave paused"
                  : dirty
                    ? "Autosave pending"
                    : `Saved · v${draft.revision}`}
          </span>
          {conflict ? (
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Reload</Button>
          ) : null}
          <Button size="icon" variant="ghost" aria-label="Undo" disabled={!canUndo} onClick={undo}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Redo" disabled={!canRedo} onClick={redo}>
            <Redo2 className="h-4 w-4" />
          </Button>
          <EmailStudioVersionHistory
            scope="flow"
            scopeId={draft.id}
            currentRevision={draft.revision}
            onRestored={(record) => {
              reset(record)
              setSelectedId(record.definition.steps[0]?.id ?? null)
            }}
          />
          <Button size="sm" variant="outline" disabled={!klaviyoConnected || saving || Boolean(proposalPreview)} onClick={() => void push(Boolean(draft.klaviyoFlowId && flowStructureStale))}>
            {draft.klaviyoFlowId
              ? flowStructureStale
                ? "Push updated draft"
                : "Sync linked emails"
              : "Push draft to Klaviyo"}
          </Button>
          {draft.klaviyoFlowId && !flowStructureStale ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={!klaviyoConnected || saving || Boolean(proposalPreview)}
              onClick={() => void push(true)}
            >
              Create replacement
            </Button>
          ) : null}
          <Button size="sm" disabled={saving || conflict || Boolean(proposalPreview)} onClick={() => void save({ announce: true, flush: true })}>
            {saving ? "Saving" : "Save now"}
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px_300px]">
        <div className="flex min-h-0 flex-col">
          <fieldset disabled={Boolean(proposalPreview)} className="grid gap-2 border-b border-border p-3 md:grid-cols-2">
            <select className={selectClass} aria-label="Trigger" value={trigger.type} onChange={(event) => {
              const type = event.target.value
              const next = type === "list"
                ? { type: "list" as const, listId: "", listName: "" }
                : type === "segment"
                  ? { type: "segment" as const, segmentId: "", segmentName: "" }
                  : type === "profile-date"
                    ? { type: "profile-date" as const, property: "", beforeUnit: "days" as const, beforeValue: 0, recurrence: "annually" as const }
                    : { type: "metric" as const, metricId: "", metricName: "" }
              patchDefinition({ ...draft.definition, trigger: next })
            }}>
              <option value="metric">Metric</option>
              <option value="list">Added to list</option>
              <option value="segment">Entered segment</option>
              <option value="profile-date">Profile date</option>
            </select>
            <TriggerFields
              trigger={trigger}
              metrics={metrics}
              lists={lists}
              segments={segments}
              onChange={(next) => patchDefinition({ ...draft.definition, trigger: next })}
            />
            <select className={selectClass} aria-label="Who can enter" value={displayDraft.definition.profileFilter.type} onChange={(event) => {
              const type = event.target.value
              const profileFilter = type === "property-equals"
                ? { type: "property-equals" as const, property: "", value: "" }
                : type === "none"
                  ? { type: "none" as const }
                  : { type: "email-subscribed" as const }
              patchDefinition({ ...draft.definition, profileFilter })
            }}>
              <option value="email-subscribed">Email subscribers</option>
              <option value="none">Everyone the trigger matches</option>
              <option value="property-equals">Profile property equals</option>
            </select>
            {displayDraft.definition.profileFilter.type === "property-equals" ? (
              <>
                <Input value={displayDraft.definition.profileFilter.property} aria-label="Filter property" placeholder="Property" onChange={(event) => patchDefinition({ ...draft.definition, profileFilter: { type: "property-equals", property: event.target.value, value: draft.definition.profileFilter.type === "property-equals" ? draft.definition.profileFilter.value : "" } })} />
                <Input value={displayDraft.definition.profileFilter.value} aria-label="Filter value" placeholder="Value" onChange={(event) => patchDefinition({ ...draft.definition, profileFilter: { type: "property-equals", property: draft.definition.profileFilter.type === "property-equals" ? draft.definition.profileFilter.property : "", value: event.target.value } })} />
              </>
            ) : null}
          </fieldset>
          {proposalPreview ? (
            <div className="border-b border-[#5574AD]/30 bg-[#5574AD]/5 px-3 py-2 text-xs text-[#355185]">
              Assistant preview · Accept or reject it in the assistant panel.
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
            <span className="mr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add after selection</span>
            {(["delay", "email", "sms", "split", "update-profile", "list-update", "webhook"] as const).map((type) => (
              <Button key={type} size="sm" variant="outline" disabled={Boolean(proposalPreview)} onClick={() => add(type)}>{type}</Button>
            ))}
          </div>
          <EmailStudioFlowCanvas
            definition={displayDraft.definition}
            selectedId={selectedId}
            projects={projects}
            onSelect={(id) => setSelectedId(id)}
          />
          <div className="space-y-2 border-t border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Push creates a draft. Messages are marked ready, and the flow stays off until you set it live.
              {draft.klaviyoFlowId
                ? ` Klaviyo ${draft.klaviyoFlowId} · ${draft.klaviyoStatus || "draft"}${klaviyoStale ? " · local changes not pushed" : " · up to date"}.`
                : ""}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={confirmLive} onChange={(event) => setConfirmLive(event.target.checked)} />
              I want this flow to start sending
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!draft.klaviyoFlowId || Boolean(proposalPreview)} onClick={() => void setStatus("draft")}>Draft</Button>
              <Button size="sm" variant="outline" disabled={!draft.klaviyoFlowId || klaviyoStale || Boolean(proposalPreview)} onClick={() => void setStatus("manual")}>Manual</Button>
              <Button size="sm" disabled={!draft.klaviyoFlowId || klaviyoStale || !confirmLive || Boolean(proposalPreview)} onClick={() => void setStatus("live")}>Set live</Button>
            </div>
            {draft.klaviyoReplacedFlowId && draft.klaviyoReplacedFlowStatus !== "draft" ? (
              <p className="text-xs text-amber-700">
                Setting this replacement live will first disable the previous {draft.klaviyoReplacedFlowStatus} flow.
              </p>
            ) : null}
          </div>
        </div>
        <aside className="min-h-0 space-y-4 overflow-y-auto border-t border-border p-3 lg:border-l lg:border-t-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Properties</p>
            <p className="mt-1 text-sm font-medium">{selected ? selected.type : "Trigger"}</p>
          </div>
          {selected ? (
            <fieldset disabled={Boolean(proposalPreview)}>
              <EmailStudioFlowStepInspector
                step={selected}
                projects={projects}
                lists={lists}
                steps={displayDraft.definition.steps}
                onChange={(step) => patchDefinition({
                  ...draft.definition,
                  steps: draft.definition.steps.map((item) => item.id === step.id ? step : item),
                })}
                onNavigate={navigateAfterSave}
              />
              <Button
                size="sm"
                variant="outline"
                className="mt-4 text-destructive"
                onClick={removeSelected}
              >
                Remove action
              </Button>
            </fieldset>
          ) : (
            <p className="text-sm text-muted-foreground">
              Trigger and entry rules are edited above the canvas.
            </p>
          )}
          <label className="block text-xs text-muted-foreground">
            Notes
            <textarea
              value={displayDraft.notes}
              disabled={Boolean(proposalPreview)}
              className="mt-1 min-h-24 w-full rounded-md border border-input bg-background p-2 text-sm text-foreground"
              onChange={(event) => change({ notes: event.target.value })}
            />
          </label>
        </aside>
        <aside className="min-h-0 border-t border-border p-3 lg:border-l lg:border-t-0">
          <EmailStudioAssistant
            scope="flow"
            scopeId={draft.id}
            baseRevision={draft.revision}
            enabled={assistantEnabled}
            initialMessages={messages}
            initialProposal={pendingProposal}
            snapshot={snapshot}
            prepare={async () => {
              const saved = await save({ flush: true })
              if (!saved) return null
              const current = getCurrent()
              return {
                baseRevision: current.revision,
                snapshot: JSON.stringify({ name: current.name, definition: current.definition }),
              }
            }}
            onFlowPreview={(next) => {
              setProposalPreview(next)
              if (next && !next.definition.steps.some((step) => step.id === selectedId)) {
                setSelectedId(next.definition.steps[0]?.id ?? null)
              }
              if (!next && !draft.definition.steps.some((step) => step.id === selectedId)) {
                setSelectedId(draft.definition.steps[0]?.id ?? null)
              }
            }}
            onFlowAccepted={(record) => {
              setProposalPreview(null)
              reset(record)
              setSelectedId(record.definition.steps[0]?.id ?? null)
            }}
          />
        </aside>
      </div>
    </div>
  )
}

function TriggerFields({
  trigger,
  metrics,
  lists,
  segments,
  onChange,
}: {
  trigger: EmailStudioFlowRecord["definition"]["trigger"]
  metrics: KlaviyoCatalogOption[]
  lists: KlaviyoCatalogOption[]
  segments: KlaviyoCatalogOption[]
  onChange: (trigger: EmailStudioFlowRecord["definition"]["trigger"]) => void
}) {
  if (trigger.type === "metric") {
    return (
      <select className={selectClass} aria-label="Metric" value={trigger.metricId} onChange={(event) => {
        const metric = metrics.find((item) => item.id === event.target.value)
        onChange({ type: "metric", metricId: event.target.value, metricName: metric?.name ?? trigger.metricName })
      }}>
        <option value="">{metrics.length ? "Choose a metric" : "Metrics not loaded"}</option>
        {trigger.metricId && !metrics.some((item) => item.id === trigger.metricId) ? <option value={trigger.metricId}>{trigger.metricName || trigger.metricId}</option> : null}
        {metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.name}</option>)}
      </select>
    )
  }
  if (trigger.type === "list") {
    return (
      <select className={selectClass} aria-label="List" value={trigger.listId} onChange={(event) => {
        const list = lists.find((item) => item.id === event.target.value)
        onChange({ type: "list", listId: event.target.value, listName: list?.name ?? "" })
      }}>
        <option value="">Choose a list</option>
        {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
      </select>
    )
  }
  if (trigger.type === "segment") {
    return (
      <select className={selectClass} aria-label="Segment" value={trigger.segmentId} onChange={(event) => {
        const segment = segments.find((item) => item.id === event.target.value)
        onChange({ type: "segment", segmentId: event.target.value, segmentName: segment?.name ?? "" })
      }}>
        <option value="">Choose a segment</option>
        {segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
      </select>
    )
  }
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Input value={trigger.property} aria-label="Date property" placeholder="Property" onChange={(event) => onChange({ ...trigger, property: event.target.value })} />
      <Input type="number" min={0} value={trigger.beforeValue} aria-label="Days before" onChange={(event) => onChange({ ...trigger, beforeValue: Number(event.target.value) })} />
      <select className={selectClass} aria-label="Repeat" value={trigger.recurrence} onChange={(event) => onChange({ ...trigger, recurrence: event.target.value as typeof trigger.recurrence })}>
        <option value="never">Once</option>
        <option value="annually">Every year</option>
        <option value="monthly">Every month</option>
        <option value="weekly">Every week</option>
      </select>
    </div>
  )
}
