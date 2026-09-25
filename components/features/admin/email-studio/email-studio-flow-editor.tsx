"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  pushEmailStudioFlowAction,
  setEmailStudioFlowStatusAction,
  updateEmailStudioFlowAction,
} from "@/lib/actions/emailStudioFlows"
import { klaviyoFromEmail, klaviyoFromLabel } from "@/lib/email-studio/flow-definition"
import type { EmailStudioFlowRecord, EmailStudioFlowStep, EmailStudioMessage, KlaviyoCatalogOption } from "@/lib/types/emailStudioFlow"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmailStudioAssistant } from "@/components/features/admin/email-studio/email-studio-assistant"
import { EmailStudioFlowSteps } from "@/components/features/admin/email-studio/email-studio-flow-steps"

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
  metrics,
  lists,
  segments,
  klaviyoConnected,
  assistantEnabled,
  messages,
}: {
  flow: EmailStudioFlowRecord
  projects: { id: string; name: string }[]
  metrics: KlaviyoCatalogOption[]
  lists: KlaviyoCatalogOption[]
  segments: KlaviyoCatalogOption[]
  klaviyoConnected: boolean
  assistantEnabled: boolean
  messages: EmailStudioMessage[]
}) {
  const [draft, setDraft] = useState(flow)
  const [selectedId, setSelectedId] = useState(flow.definition.steps[0]?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [confirmLive, setConfirmLive] = useState(false)
  const snapshot = useMemo(() => JSON.stringify({ name: draft.name, definition: draft.definition }), [draft])

  function patchDefinition(definition: EmailStudioFlowRecord["definition"]) {
    setDraft((current) => ({ ...current, definition }))
  }

  function add(type: EmailStudioFlowStep["type"]) {
    const step = newStep(type)
    const steps = [...draft.definition.steps]
    const entry = draft.definition.entryStepId
    if (!entry) {
      patchDefinition({ ...draft.definition, entryStepId: step.id, steps: [...steps, step] })
    } else {
      const linked = steps.map((item) => {
        if (item.id !== selectedId || item.type === "split" || item.next) return item
        return { ...item, next: step.id }
      })
      const attached = linked.some((item, index) => item !== steps[index])
      patchDefinition({
        ...draft.definition,
        entryStepId: attached || entry ? entry : step.id,
        steps: [...linked, step],
      })
    }
    setSelectedId(step.id)
  }

  async function save() {
    setSaving(true)
    const result = await updateEmailStudioFlowAction({
      id: draft.id,
      name: draft.name,
      notes: draft.notes,
      definition: draft.definition,
    })
    setSaving(false)
    if ("error" in result) {
      toast.error(result.error)
      return false
    }
    toast.success("Saved")
    return true
  }

  async function push(replace: boolean) {
    const ok = await save()
    if (!ok) return
    const result = await pushEmailStudioFlowAction({ id: draft.id, replace })
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setDraft((current) => ({ ...current, klaviyoFlowId: result.klaviyoFlowId, klaviyoStatus: "draft" }))
    toast.success(result.replacedId ? "New Klaviyo draft created. The previous flow is still in Klaviyo." : "Draft flow is in Klaviyo. It is not sending.")
  }

  const trigger = draft.definition.trigger
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Button variant="ghost" size="sm" asChild><Link href="/admin/email-studio/flows">Flows</Link></Button>
        <Input value={draft.name} aria-label="Flow name" className="h-9 max-w-xs" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!klaviyoConnected || saving} onClick={() => void push(Boolean(draft.klaviyoFlowId))}>
            {draft.klaviyoFlowId ? "Push new Klaviyo draft" : "Push draft to Klaviyo"}
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void save()}>{saving ? "Saving" : "Save"}</Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-h-0 space-y-4 overflow-y-auto p-4">
          <div className="grid gap-2 md:grid-cols-2">
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
            <select className={selectClass} aria-label="Who can enter" value={draft.definition.profileFilter.type} onChange={(event) => {
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
            {draft.definition.profileFilter.type === "property-equals" ? (
              <>
                <Input value={draft.definition.profileFilter.property} aria-label="Filter property" placeholder="Property" onChange={(event) => patchDefinition({ ...draft.definition, profileFilter: { type: "property-equals", property: event.target.value, value: draft.definition.profileFilter.type === "property-equals" ? draft.definition.profileFilter.value : "" } })} />
                <Input value={draft.definition.profileFilter.value} aria-label="Filter value" placeholder="Value" onChange={(event) => patchDefinition({ ...draft.definition, profileFilter: { type: "property-equals", property: draft.definition.profileFilter.type === "property-equals" ? draft.definition.profileFilter.property : "", value: event.target.value } })} />
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1">
            {(["delay", "email", "sms", "split", "update-profile", "list-update", "webhook"] as const).map((type) => (
              <Button key={type} size="sm" variant="outline" onClick={() => add(type)}>{type}</Button>
            ))}
          </div>
          <EmailStudioFlowSteps
            steps={draft.definition.steps}
            selectedId={selectedId}
            projects={projects}
            lists={lists}
            onSelect={setSelectedId}
            onChange={(step) => patchDefinition({
              ...draft.definition,
              steps: draft.definition.steps.map((item) => (item.id === step.id ? step : item)),
            })}
          />
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Push creates a draft. Messages are marked ready, and the flow stays off until you set it live.
              {draft.klaviyoFlowId ? ` Klaviyo ${draft.klaviyoFlowId} · ${draft.klaviyoStatus || "draft"}.` : ""}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={confirmLive} onChange={(event) => setConfirmLive(event.target.checked)} />
              I want this flow to start sending
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!draft.klaviyoFlowId} onClick={() => void setEmailStudioFlowStatusAction({ id: draft.id, status: "draft" }).then((result) => "error" in result ? toast.error(result.error) : toast.success("Set to draft"))}>Draft</Button>
              <Button size="sm" variant="outline" disabled={!draft.klaviyoFlowId} onClick={() => void setEmailStudioFlowStatusAction({ id: draft.id, status: "manual" }).then((result) => "error" in result ? toast.error(result.error) : toast.success("Set to manual"))}>Manual</Button>
              <Button size="sm" disabled={!draft.klaviyoFlowId || !confirmLive} onClick={() => void setEmailStudioFlowStatusAction({ id: draft.id, status: "live", confirmLive: true }).then((result) => "error" in result ? toast.error(result.error) : toast.success("Flow is live"))}>Set live</Button>
            </div>
          </div>
        </div>
        <aside className="min-h-0 border-t border-border p-3 lg:border-l lg:border-t-0">
          <EmailStudioAssistant scope="flow" scopeId={draft.id} enabled={assistantEnabled} initialMessages={messages} snapshot={snapshot} />
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
