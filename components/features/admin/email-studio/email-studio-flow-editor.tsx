"use client"

import { useEffect, useMemo, useState } from "react"
import type { MouseEvent as ReactMouseEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Redo2, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { generateEmailStudioAction } from "@/lib/actions/emailStudio"
import {
  publishEmailStudioFlowAction,
  pushEmailStudioFlowAction,
  setEmailStudioFlowStatusAction,
} from "@/lib/actions/emailStudioFlows"
import type { FlowInsertAnchor } from "@/lib/email-studio/flow-layout"
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
  const [publishing, setPublishing] = useState(false)
  const [proposalPreview, setProposalPreview] = useState<EmailStudioFlowSnapshot | null>(
    pendingProposal?.flow ?? null,
  )
  const displayDraft = proposalPreview ? { ...draft, ...proposalPreview } : draft
  const snapshot = useMemo(() => JSON.stringify({ name: draft.name, definition: draft.definition }), [draft])

  function patchDefinition(definition: EmailStudioFlowRecord["definition"]): void {
    if (proposalPreview) return
    commitDefinition(definition)
  }

  function add(type: EmailStudioFlowStep["type"], anchor?: FlowInsertAnchor) {
    if (proposalPreview) return
    if (draft.definition.steps.length >= 40) {
      toast.error("A flow can contain up to 40 actions.")
      return
    }
    const step = newStep(type)
    const steps = [...draft.definition.steps]
    const entry = draft.definition.entryStepId
    if (anchor?.kind === "entry" || !entry) {
      patchDefinition({ ...draft.definition, entryStepId: step.id, steps: [...steps, step] })
    } else if (anchor) {
      const parent = steps.find((item) => item.id === anchor.stepId)
      if (!parent) return
      if (anchor.kind === "next" && parent.type !== "split") {
        patchDefinition({
          ...draft.definition,
          steps: [
            ...steps.map((item) => item.id === parent.id ? { ...parent, next: step.id } : item),
            step,
          ],
        })
      } else if ((anchor.kind === "yes" || anchor.kind === "no") && parent.type === "split") {
        patchDefinition({
          ...draft.definition,
          steps: [
            ...steps.map((item) => item.id === parent.id ? { ...parent, [anchor.kind]: step.id } : item),
            step,
          ],
        })
      } else {
        return
      }
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
      klaviyoStatus: result.status,
      klaviyoReplacedFlowId: result.status === "live" ? null : draft.klaviyoReplacedFlowId,
      klaviyoReplacedFlowStatus: result.status === "live" ? null : draft.klaviyoReplacedFlowStatus,
    })
    if (result.warning) toast.warning(result.warning)
    else toast.success(result.status === "live" ? "Flow is live" : `Set to ${result.status}`)
  }

  async function publishLive(): Promise<void> {
    setPublishing(true)
    const saved = await save({ flush: true })
    if (!saved) {
      setPublishing(false)
      return
    }
    const result = await publishEmailStudioFlowAction({
      id: draft.id,
      confirmLive: true,
    })
    setPublishing(false)
    if ("error" in result) {
      toast.error(result.error)
      router.refresh()
      return
    }
    mergeServerFields({
      klaviyoFlowId: result.klaviyoFlowId,
      klaviyoStatus: "live",
      klaviyoSyncedRevision: result.syncedRevision,
      klaviyoContentChecksum: result.checksum,
      klaviyoSyncedAt: result.syncedAt,
      klaviyoReplacedFlowId: null,
      klaviyoReplacedFlowStatus: null,
    })
    setConfirmLive(false)
    if (result.warning) toast.warning(result.warning)
    else toast.success("Flow published and verified live in Klaviyo.")
    router.refresh()
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
          <Button
            size="sm"
            disabled={!klaviyoConnected || saving || publishing || Boolean(proposalPreview)}
            onClick={() => setConfirmLive(true)}
          >
            {publishing ? "Publishing…" : draft.klaviyoStatus === "live" ? "Republish live" : "Publish live"}
          </Button>
          <Button size="sm" disabled={saving || conflict || Boolean(proposalPreview)} onClick={() => void save({ announce: true, flush: true })}>
            {saving ? "Saving" : "Save now"}
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px_360px]">
        <div className="flex min-h-0 flex-col">
          {proposalPreview ? (
            <div className="border-b border-[#5574AD]/30 bg-[#5574AD]/5 px-3 py-2 text-xs text-[#355185]">
              Assistant preview · Accept or reject it in the assistant panel.
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
            <span className="mr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add after selected action</span>
            {([
              ["delay", "Time delay"],
              ["email", "Email"],
              ["sms", "SMS"],
              ["split", "Conditional split"],
              ["update-profile", "Update profile"],
              ["list-update", "List update"],
              ["webhook", "Webhook"],
            ] as const).map(([type, label]) => (
              <Button key={type} size="sm" variant="outline" disabled={Boolean(proposalPreview)} onClick={() => add(type)}>{label}</Button>
            ))}
          </div>
          <EmailStudioFlowCanvas
            definition={displayDraft.definition}
            selectedId={selectedId}
            projects={projects}
            onSelect={(id) => setSelectedId(id)}
            onInsert={(anchor, type) => add(type, anchor)}
            disabled={Boolean(proposalPreview)}
          />
          <div className="space-y-3 border-t border-border px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium">Klaviyo publishing</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {draft.klaviyoFlowId
                    ? `${draft.klaviyoStatus || "draft"} · ${klaviyoStale ? "changes waiting to publish" : "verified up to date"}`
                    : "Not published yet"}
                </p>
              </div>
              <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                draft.klaviyoStatus === "live"
                  ? "bg-emerald-100 text-emerald-700"
                  : draft.klaviyoStatus === "manual"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-600"
              }`}>
                {draft.klaviyoStatus || "local draft"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="rounded-md border border-border bg-background p-2">
                <span className={draft.klaviyoFlowId ? "text-emerald-600" : "text-muted-foreground"}>1. Sync</span>
              </div>
              <div className="rounded-md border border-border bg-background p-2">
                <span className={draft.klaviyoFlowId && !klaviyoStale ? "text-emerald-600" : "text-muted-foreground"}>2. Verify</span>
              </div>
              <div className="rounded-md border border-border bg-background p-2">
                <span className={draft.klaviyoStatus === "live" ? "text-emerald-600" : "text-muted-foreground"}>3. Live</span>
              </div>
            </div>
            {confirmLive ? (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-900">Publish this flow live?</p>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  The latest flow and every linked email will be synced first. Once Klaviyo verifies them, eligible profiles can start receiving messages.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={publishing} onClick={() => void publishLive()}>
                    {publishing ? "Publishing…" : "Sync, verify, and publish"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={publishing} onClick={() => setConfirmLive(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setConfirmLive(true)} disabled={!klaviyoConnected || Boolean(proposalPreview)}>
                  {draft.klaviyoStatus === "live" ? "Publish latest changes" : "Publish live"}
                </Button>
                <Button size="sm" variant="outline" disabled={!draft.klaviyoFlowId || Boolean(proposalPreview)} onClick={() => void setStatus("draft")}>Pause to draft</Button>
                <Button size="sm" variant="outline" disabled={!draft.klaviyoFlowId || klaviyoStale || Boolean(proposalPreview)} onClick={() => void setStatus("manual")}>Manual</Button>
              </div>
            )}
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
                canGenerate={assistantEnabled}
                onGenerateEmail={async (stepId, brief) => {
                  const result = await generateEmailStudioAction({
                    brief: `Design one email in the flow "${draft.name}". Trigger: ${triggerSummary(draft.definition.trigger)}. ${brief}`.slice(0, 2000),
                    name: `${draft.name} email`.slice(0, 120),
                    target: "email",
                  })
                  if ("error" in result) {
                    toast.error(result.error)
                    return
                  }
                  patchDefinition({
                    ...getCurrent().definition,
                    steps: getCurrent().definition.steps.map((item) => (
                      item.id === stepId && item.type === "email" ? { ...item, projectId: result.id } : item
                    )),
                  })
                  const saved = await save({ flush: true })
                  if (!saved) return
                  toast.success("Designed email is linked. Open it on the artboard.")
                  router.refresh()
                }}
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
            <TriggerInspector
              definition={displayDraft.definition}
              metrics={metrics}
              lists={lists}
              segments={segments}
              disabled={Boolean(proposalPreview)}
              onChange={patchDefinition}
            />
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

function triggerSummary(trigger: EmailStudioFlowRecord["definition"]["trigger"]): string {
  if (trigger.type === "metric") return trigger.metricName || trigger.metricId || "metric"
  if (trigger.type === "list") return trigger.listName || trigger.listId || "list"
  if (trigger.type === "segment") return trigger.segmentName || trigger.segmentId || "segment"
  return trigger.property || "profile date"
}

function TriggerInspector({
  definition,
  metrics,
  lists,
  segments,
  disabled,
  onChange,
}: {
  definition: EmailStudioFlowRecord["definition"]
  metrics: KlaviyoCatalogOption[]
  lists: KlaviyoCatalogOption[]
  segments: KlaviyoCatalogOption[]
  disabled: boolean
  onChange: (definition: EmailStudioFlowRecord["definition"]) => void
}) {
  const trigger = definition.trigger
  return (
    <fieldset disabled={disabled} className="space-y-4">
      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Trigger</p>
        <select className={`${selectClass} w-full`} aria-label="Trigger type" value={trigger.type} onChange={(event) => {
          const type = event.target.value
          const next = type === "list"
            ? { type: "list" as const, listId: "", listName: "" }
            : type === "segment"
              ? { type: "segment" as const, segmentId: "", segmentName: "" }
              : type === "profile-date"
                ? { type: "profile-date" as const, property: "", beforeUnit: "days" as const, beforeValue: 0, recurrence: "annually" as const }
                : { type: "metric" as const, metricId: "", metricName: "" }
          onChange({ ...definition, trigger: next })
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
          onChange={(next) => onChange({ ...definition, trigger: next })}
        />
      </div>
      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Entry filter</p>
        <select className={`${selectClass} w-full`} aria-label="Who can enter" value={definition.profileFilter.type} onChange={(event) => {
          const type = event.target.value
          const profileFilter = type === "property-equals"
            ? { type: "property-equals" as const, property: "", value: "" }
            : type === "none"
              ? { type: "none" as const }
              : { type: "email-subscribed" as const }
          onChange({ ...definition, profileFilter })
        }}>
          <option value="email-subscribed">Email subscribers</option>
          <option value="none">Everyone the trigger matches</option>
          <option value="property-equals">Profile property equals</option>
        </select>
        {definition.profileFilter.type === "property-equals" ? (
          <div className="space-y-2">
            <Input
              value={definition.profileFilter.property}
              aria-label="Filter property"
              placeholder="Property"
              onChange={(event) => onChange({
                ...definition,
                profileFilter: {
                  type: "property-equals",
                  property: event.target.value,
                  value: definition.profileFilter.type === "property-equals"
                    ? definition.profileFilter.value
                    : "",
                },
              })}
            />
            <Input
              value={definition.profileFilter.value}
              aria-label="Filter value"
              placeholder="Value"
              onChange={(event) => onChange({
                ...definition,
                profileFilter: {
                  type: "property-equals",
                  property: definition.profileFilter.type === "property-equals"
                    ? definition.profileFilter.property
                    : "",
                  value: event.target.value,
                },
              })}
            />
          </div>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Select another card on the canvas to configure that action.
      </p>
    </fieldset>
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
      <select className={`${selectClass} w-full`} aria-label="Metric" value={trigger.metricId} onChange={(event) => {
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
      <select className={`${selectClass} w-full`} aria-label="List" value={trigger.listId} onChange={(event) => {
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
      <select className={`${selectClass} w-full`} aria-label="Segment" value={trigger.segmentId} onChange={(event) => {
        const segment = segments.find((item) => item.id === event.target.value)
        onChange({ type: "segment", segmentId: event.target.value, segmentName: segment?.name ?? "" })
      }}>
        <option value="">Choose a segment</option>
        {segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
      </select>
    )
  }
  return (
    <div className="space-y-2">
      <Input value={trigger.property} aria-label="Date property" placeholder="Property" onChange={(event) => onChange({ ...trigger, property: event.target.value })} />
      <Input type="number" min={0} value={trigger.beforeValue} aria-label="Days before" onChange={(event) => onChange({ ...trigger, beforeValue: Number(event.target.value) })} />
      <select className={`${selectClass} w-full`} aria-label="Repeat" value={trigger.recurrence} onChange={(event) => onChange({ ...trigger, recurrence: event.target.value as typeof trigger.recurrence })}>
        <option value="never">Once</option>
        <option value="annually">Every year</option>
        <option value="monthly">Every month</option>
        <option value="weekly">Every week</option>
      </select>
    </div>
  )
}
