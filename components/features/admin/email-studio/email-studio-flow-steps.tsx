"use client"

import Link from "next/link"
import type { EmailStudioFlowStep } from "@/lib/types/emailStudioFlow"
import { flowStepLabel } from "@/lib/email-studio/flow-definition"
import { Input } from "@/components/ui/input"

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm"

export function EmailStudioFlowSteps({
  steps,
  selectedId,
  projects,
  lists,
  onSelect,
  onChange,
}: {
  steps: EmailStudioFlowStep[]
  selectedId: string | null
  projects: { id: string; name: string }[]
  lists: { id: string; name: string }[]
  onSelect: (id: string) => void
  onChange: (step: EmailStudioFlowStep) => void
}) {
  const selected = steps.find((step) => step.id === selectedId) ?? null
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <ul className="space-y-1">
        {steps.map((step, index) => (
          <li key={step.id}>
            <button
              type="button"
              className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${step.id === selectedId ? "bg-muted" : ""}`}
              onClick={() => onSelect(step.id)}
            >
              {index + 1}. {flowStepLabel(step)}
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <StepFields step={selected} projects={projects} lists={lists} steps={steps} onChange={onChange} />
      ) : (
        <p className="text-sm text-muted-foreground">Add an action, then edit it here.</p>
      )}
    </div>
  )
}

function StepFields({
  step,
  projects,
  lists,
  steps,
  onChange,
}: {
  step: EmailStudioFlowStep
  projects: { id: string; name: string }[]
  lists: { id: string; name: string }[]
  steps: EmailStudioFlowStep[]
  onChange: (step: EmailStudioFlowStep) => void
}) {
  const nextOptions = steps.filter((item) => item.id !== step.id)
  if (step.type === "delay") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Input type="number" min={1} value={step.value} aria-label="Delay length" onChange={(event) => onChange({ ...step, value: Number(event.target.value) })} />
        <select className={selectClass} aria-label="Delay unit" value={step.unit} onChange={(event) => onChange({ ...step, unit: event.target.value as typeof step.unit })}>
          <option value="minutes">Minutes</option>
          <option value="hours">Hours</option>
          <option value="days">Days</option>
        </select>
      </div>
    )
  }
  if (step.type === "email") {
    return (
      <div className="space-y-2">
        <select className={selectClass} aria-label="Email project" value={step.projectId} onChange={(event) => onChange({ ...step, projectId: event.target.value })}>
          <option value="">Choose an email</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        {step.projectId ? <Link className="text-xs text-[#355185] hover:underline" href={`/admin/email-studio/${step.projectId}`}>Open email</Link> : null}
        <Input value={step.fromLabel} aria-label="From name" onChange={(event) => onChange({ ...step, fromLabel: event.target.value })} />
        <Input value={step.fromEmail} aria-label="From email" onChange={(event) => onChange({ ...step, fromEmail: event.target.value })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={step.smartSending} onChange={(event) => onChange({ ...step, smartSending: event.target.checked })} />
          Smart sending
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={step.transactional} onChange={(event) => onChange({ ...step, transactional: event.target.checked })} />
          Transactional
        </label>
      </div>
    )
  }
  if (step.type === "sms") {
    return <textarea className="min-h-28 w-full rounded-md border border-input bg-background p-2 text-sm" aria-label="SMS body" value={step.body} onChange={(event) => onChange({ ...step, body: event.target.value })} />
  }
  if (step.type === "webhook") {
    return (
      <div className="space-y-2">
        <Input value={step.url} aria-label="Webhook URL" placeholder="https://" onChange={(event) => onChange({ ...step, url: event.target.value })} />
        <textarea className="min-h-24 w-full rounded-md border border-input bg-background p-2 font-mono text-xs" aria-label="Webhook body" value={step.body} onChange={(event) => onChange({ ...step, body: event.target.value })} />
      </div>
    )
  }
  if (step.type === "update-profile") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={step.property} aria-label="Profile property" placeholder="Property" onChange={(event) => onChange({ ...step, property: event.target.value })} />
        <Input value={step.value} aria-label="Property value" placeholder="Value" onChange={(event) => onChange({ ...step, value: event.target.value })} />
      </div>
    )
  }
  if (step.type === "list-update") {
    return (
      <div className="space-y-2">
        <select className={selectClass} aria-label="List" value={step.listId} onChange={(event) => onChange({ ...step, listId: event.target.value })}>
          <option value="">Choose a list</option>
          {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={step.add} onChange={(event) => onChange({ ...step, add: event.target.checked })} />
          Add to the list. Uncheck to remove.
        </label>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <select className={selectClass} aria-label="Split type" value={step.mode} onChange={(event) => onChange({ ...step, mode: event.target.value as typeof step.mode })}>
        <option value="email-subscribed">Can receive email</option>
        <option value="profile-property">Profile property equals</option>
        <option value="event-property">Event property</option>
      </select>
      {step.mode !== "email-subscribed" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <Input value={step.property} aria-label="Property" placeholder="Property" onChange={(event) => onChange({ ...step, property: event.target.value })} />
          <select className={selectClass} aria-label="Operator" value={step.operator} onChange={(event) => onChange({ ...step, operator: event.target.value as typeof step.operator })}>
            <option value="equals">Equals</option>
            <option value="contains">Contains</option>
            <option value="not-equals">Does not equal</option>
          </select>
          <Input value={step.value} aria-label="Split value" placeholder="Value" onChange={(event) => onChange({ ...step, value: event.target.value })} />
        </div>
      ) : null}
      <BranchSelect label="Yes path" value={step.yes} options={nextOptions} onChange={(yes) => onChange({ ...step, yes })} />
      <BranchSelect label="No path" value={step.no} options={nextOptions} onChange={(no) => onChange({ ...step, no })} />
    </div>
  )
}

function BranchSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | null
  options: EmailStudioFlowStep[]
  onChange: (value: string | null) => void
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      <select className={`${selectClass} mt-1`} value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">End</option>
        {options.map((step) => <option key={step.id} value={step.id}>{flowStepLabel(step)}</option>)}
      </select>
    </label>
  )
}
