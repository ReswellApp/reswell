"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { toast } from "sonner"
import {
  pushEmailStudioToKlaviyoAction,
  saveEmailStudioTemplateAction,
  updateEmailStudioAction,
} from "@/lib/actions/emailStudio"
import { createEmailBlock } from "@/lib/email-studio/document"
import { renderEmailStudioHtml, withEmailPreviewSamples } from "@/lib/email-studio/render-html"
import { KNOWN_KLAVIYO_METRIC_NAMES } from "@/lib/klaviyo/event-log-shared"
import type { EmailBlockType, EmailStudioFlowOption, EmailStudioRecord } from "@/lib/types/emailStudio"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmailStudioInspector } from "@/components/features/admin/email-studio/email-studio-inspector"
import { EmailStudioOutlineRow, emailBlockLabel } from "@/components/features/admin/email-studio/email-studio-outline"

const ADDABLE: EmailBlockType[] = [
  "logo",
  "eyebrow",
  "heading",
  "text",
  "image",
  "button",
  "split",
  "details",
  "divider",
  "spacer",
  "footer",
]

export function EmailStudioEditor({
  project,
  flows,
  klaviyoConnected,
}: {
  project: EmailStudioRecord
  flows: EmailStudioFlowOption[]
  klaviyoConnected: boolean
}) {
  const router = useRouter()
  const [draft, setDraft] = useState(project)
  const [selectedId, setSelectedId] = useState(project.document.blocks[0]?.id ?? null)
  const [mode, setMode] = useState<"display" | "code">("display")
  const [frameWidth, setFrameWidth] = useState<375 | 600>(600)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const html = useMemo(
    () =>
      renderEmailStudioHtml({
        name: draft.name,
        subject: draft.subject,
        previewText: draft.previewText,
        flowName: draft.flowName,
        triggerMetric: draft.triggerMetric,
        document: draft.document,
      }),
    [draft],
  )
  const selected = draft.document.blocks.find((block) => block.id === selectedId) ?? null

  function patch(next: Partial<EmailStudioRecord>) {
    setDraft((current) => ({ ...current, ...next }))
    setDirty(true)
  }

  function updateBlocks(blocks: EmailStudioRecord["document"]["blocks"]) {
    patch({ document: { blocks } })
  }

  async function save(): Promise<boolean> {
    setSaving(true)
    const result = await updateEmailStudioAction({
      id: draft.id,
      name: draft.name,
      subject: draft.subject,
      previewText: draft.previewText,
      flowName: draft.flowName,
      flowId: draft.flowId,
      triggerMetric: draft.triggerMetric,
      notes: draft.notes,
      document: draft.document,
    })
    setSaving(false)
    if ("error" in result) {
      toast.error(result.error)
      return false
    }
    setDirty(false)
    toast.success("Saved")
    return true
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = draft.document.blocks.map((block) => block.id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    updateBlocks(arrayMove(draft.document.blocks, from, to))
  }

  function addBlock(type: EmailBlockType) {
    const block = createEmailBlock(type)
    const blocks = [...draft.document.blocks]
    const index = blocks.findIndex((item) => item.id === selectedId)
    blocks.splice(index >= 0 ? index + 1 : blocks.length, 0, block)
    updateBlocks(blocks)
    setSelectedId(block.id)
  }

  function download() {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${draft.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reswell-email"}.html`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function pushKlaviyo() {
    const ok = dirty ? await save() : true
    if (!ok) return
    const result = await pushEmailStudioToKlaviyoAction({ id: draft.id })
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setDraft((current) => ({ ...current, klaviyoTemplateId: result.templateId }))
    toast.success("Template is in Klaviyo. Attach it to the flow there before it sends.")
  }

  async function saveTemplate() {
    const name = templateName.trim()
    if (!name) {
      toast.error("Name the template")
      return
    }
    const ok = dirty ? await save() : true
    if (!ok) return
    const result = await saveEmailStudioTemplateAction({ id: draft.id, name })
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setTemplateName("")
    toast.success("Template saved. New projects can start from it.")
    router.refresh()
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/email-studio">Projects</Link>
        </Button>
        <Input
          value={draft.name}
          aria-label="Project name"
          className="h-9 max-w-xs"
          onChange={(event) => patch({ name: event.target.value })}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{dirty ? "Unsaved" : "Saved"}</span>
          <Button size="sm" variant="outline" onClick={download}>Download HTML</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(html)
              toast.success("HTML copied")
            }}
          >
            Copy HTML
          </Button>
          <Button size="sm" variant="outline" disabled={!klaviyoConnected || saving} onClick={() => void pushKlaviyo()}>
            {klaviyoConnected ? "Push to Klaviyo" : "Klaviyo key missing"}
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void save()}>{saving ? "Saving" : "Save"}</Button>
        </div>
      </div>

      <div className="grid gap-2 border-b border-border px-3 py-2 md:grid-cols-4">
        <Input value={draft.subject} placeholder="Subject" aria-label="Subject" onChange={(event) => patch({ subject: event.target.value })} />
        <Input value={draft.previewText} placeholder="Preview text" aria-label="Preview text" onChange={(event) => patch({ previewText: event.target.value })} />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Trigger metric"
          value={draft.triggerMetric}
          onChange={(event) => patch({ triggerMetric: event.target.value })}
        >
          <option value="">Trigger metric</option>
          {KNOWN_KLAVIYO_METRIC_NAMES.map((metric) => (
            <option key={metric} value={metric}>{metric}</option>
          ))}
          {draft.triggerMetric && !KNOWN_KLAVIYO_METRIC_NAMES.includes(draft.triggerMetric) ? (
            <option value={draft.triggerMetric}>{draft.triggerMetric}</option>
          ) : null}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Klaviyo flow"
          value={draft.flowId}
          onChange={(event) => {
            const flow = flows.find((item) => item.id === event.target.value)
            patch({ flowId: event.target.value, flowName: flow?.name ?? draft.flowName })
          }}
        >
          <option value="">{flows.length ? "Link a Klaviyo flow" : "No flows loaded"}</option>
          {draft.flowId && !flows.some((flow) => flow.id === draft.flowId) ? (
            <option value={draft.flowId}>{draft.flowName || draft.flowId}</option>
          ) : null}
          {flows.map((flow) => (
            <option key={flow.id} value={flow.id}>{flow.name} · {flow.status}</option>
          ))}
        </select>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-b border-border p-3 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap gap-1">
            {ADDABLE.map((type) => (
              <button
                key={type}
                type="button"
                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                onClick={() => addBlock(type)}
              >
                {emailBlockLabel(type)}
              </button>
            ))}
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={draft.document.blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {draft.document.blocks.map((block, index) => (
                  <EmailStudioOutlineRow
                    key={block.id}
                    block={block}
                    active={block.id === selectedId}
                    onSelect={() => setSelectedId(block.id)}
                    onRemove={() => {
                      updateBlocks(draft.document.blocks.filter((item) => item.id !== block.id))
                      if (selectedId === block.id) setSelectedId(draft.document.blocks[index + 1]?.id ?? draft.document.blocks[index - 1]?.id ?? null)
                    }}
                    onMove={(direction) => {
                      const next = index + direction
                      if (next < 0 || next >= draft.document.blocks.length) return
                      updateBlocks(arrayMove(draft.document.blocks, index, next))
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </aside>

        <section className="flex min-h-[420px] min-w-0 flex-col bg-[#F4F6F8]">
          <div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2">
            <div className="inline-flex rounded-md border border-border p-0.5">
              <button type="button" className={`rounded px-3 py-1 text-sm ${mode === "display" ? "bg-foreground text-background" : ""}`} onClick={() => setMode("display")}>Display</button>
              <button type="button" className={`rounded px-3 py-1 text-sm ${mode === "code" ? "bg-foreground text-background" : ""}`} onClick={() => setMode("code")}>Code</button>
            </div>
            {mode === "display" ? (
              <div className="inline-flex rounded-md border border-border p-0.5">
                <button type="button" className={`rounded px-2 py-1 text-xs ${frameWidth === 600 ? "bg-muted" : ""}`} onClick={() => setFrameWidth(600)}>Desktop</button>
                <button type="button" className={`rounded px-2 py-1 text-xs ${frameWidth === 375 ? "bg-muted" : ""}`} onClick={() => setFrameWidth(375)}>Phone</button>
              </div>
            ) : null}
          </div>
          {mode === "display" ? (
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <iframe
                title="Email display"
                sandbox=""
                srcDoc={withEmailPreviewSamples(html)}
                style={{ width: frameWidth }}
                className="mx-auto block h-[720px] max-w-full rounded-md border border-border bg-white shadow-sm"
              />
            </div>
          ) : (
            <textarea
              readOnly
              value={html}
              aria-label="Email HTML"
              className="min-h-0 flex-1 resize-none bg-[#0F172A] p-4 font-mono text-xs leading-5 text-[#E2E8F0]"
            />
          )}
        </section>

        <aside className="min-h-0 overflow-y-auto border-t border-border p-3 lg:border-l lg:border-t-0">
          <EmailStudioInspector
            block={selected}
            onChange={(block) => updateBlocks(draft.document.blocks.map((item) => (item.id === block.id ? block : item)))}
          />
          <div className="mt-6 space-y-2 border-t border-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Save as template</p>
            <Input value={templateName} placeholder="Template name" onChange={(event) => setTemplateName(event.target.value)} />
            <Button size="sm" variant="outline" onClick={() => void saveTemplate()}>Save template</Button>
            <p className="text-xs text-muted-foreground">
              Push stores a code template in Klaviyo. It does not turn a flow on. Download HTML if the key is unavailable.
            </p>
            {draft.klaviyoTemplateId ? (
              <p className="break-all text-xs text-muted-foreground">Klaviyo template {draft.klaviyoTemplateId}</p>
            ) : null}
            <label className="block text-xs text-muted-foreground">
              Notes
              <textarea
                value={draft.notes}
                className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm text-foreground"
                onChange={(event) => patch({ notes: event.target.value })}
              />
            </label>
            {!draft.flowId ? (
              <Input
                value={draft.flowName}
                placeholder="Flow name if it is not in the list"
                onChange={(event) => patch({ flowName: event.target.value })}
              />
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}
