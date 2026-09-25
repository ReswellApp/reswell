"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { toast } from "sonner"
import {
  pushEmailStudioToKlaviyoAction,
  saveEmailStudioTemplateAction,
  updateEmailStudioAction,
} from "@/lib/actions/emailStudio"
import { createEmailBlock, emailBlockId } from "@/lib/email-studio/document"
import { renderEmailStudioHtml, resolveEmailStudioHtml } from "@/lib/email-studio/render-html"
import { KNOWN_KLAVIYO_METRIC_NAMES } from "@/lib/klaviyo/event-log-shared"
import type { EmailBlockType, EmailStudioFlowOption, EmailStudioRecord } from "@/lib/types/emailStudio"
import type { EmailStudioMessage } from "@/lib/types/emailStudioFlow"
import { EmailStudioAssistant } from "@/components/features/admin/email-studio/email-studio-assistant"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmailStudioCanvas, EmailStudioPaletteChip } from "@/components/features/admin/email-studio/email-studio-canvas"
import { EmailStudioInspector } from "@/components/features/admin/email-studio/email-studio-inspector"
import { emailBlockLabel } from "@/components/features/admin/email-studio/email-studio-outline"

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
  assistantEnabled,
  messages,
}: {
  project: EmailStudioRecord
  flows: EmailStudioFlowOption[]
  klaviyoConnected: boolean
  assistantEnabled: boolean
  messages: EmailStudioMessage[]
}) {
  const router = useRouter()
  const [draft, setDraft] = useState(project)
  const [selectedId, setSelectedId] = useState(project.document.blocks[0]?.id ?? null)
  const [mode, setMode] = useState<"display" | "code">("display")
  const [frameWidth, setFrameWidth] = useState<375 | 600>(600)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [draggingLabel, setDraggingLabel] = useState<string | null>(null)
  const suppressPaletteClick = useRef(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const renderInput = useMemo(
    () => ({
      name: draft.name,
      subject: draft.subject,
      previewText: draft.previewText,
      flowName: draft.flowName,
      triggerMetric: draft.triggerMetric,
      document: draft.document,
    }),
    [draft],
  )
  const generatedHtml = useMemo(() => renderEmailStudioHtml(renderInput), [renderInput])
  const html = useMemo(() => resolveEmailStudioHtml(renderInput), [renderInput])
  const customHtml = Boolean(draft.document.htmlOverride?.trim())
  const selected = draft.document.blocks.find((block) => block.id === selectedId) ?? null

  function patch(next: Partial<EmailStudioRecord>) {
    setDraft((current) => ({ ...current, ...next }))
    setDirty(true)
  }

  function updateBlocks(blocks: EmailStudioRecord["document"]["blocks"]) {
    if (draft.document.htmlOverride) {
      toast.message("Page edit replaced the custom HTML.")
    }
    patch({ document: { blocks, htmlOverride: null } })
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

  const collision: CollisionDetection = (args) => {
    const hits = pointerWithin(args)
    return hits.length > 0 ? hits : closestCenter(args)
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingLabel(null)
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId.startsWith("palette:")) {
      const type = activeId.slice("palette:".length) as EmailBlockType
      const block = createEmailBlock(type)
      const blocks = [...draft.document.blocks]
      const index = blocks.findIndex((item) => item.id === overId)
      blocks.splice(overId === "canvas-end" || index < 0 ? blocks.length : index, 0, block)
      updateBlocks(blocks)
      setSelectedId(block.id)
      return
    }
    if (activeId === overId) return
    const ids = draft.document.blocks.map((block) => block.id)
    const from = ids.indexOf(activeId)
    const to = overId === "canvas-end" ? ids.length - 1 : ids.indexOf(overId)
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
          <Button size="sm" variant="outline" onClick={() => setAssistantOpen((open) => !open)}>
            {assistantOpen ? "Hide assistant" : "Assistant"}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/email-studio/flows">Flows</Link>
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

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={(event) => {
          suppressPaletteClick.current = true
          const id = String(event.active.id)
          setDraggingLabel(id.startsWith("palette:") ? emailBlockLabel(id.slice("palette:".length) as EmailBlockType) : "Block")
        }}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDraggingLabel(null)}
      >
      <div className={`grid min-h-0 flex-1 ${assistantOpen ? "lg:grid-cols-[200px_minmax(0,1fr)_280px_300px]" : "lg:grid-cols-[200px_minmax(0,1fr)_300px]"}`}>
        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-b border-border p-3 lg:border-b-0 lg:border-r">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Drag onto the email</p>
          <div className="flex flex-wrap gap-1">
            {ADDABLE.map((type) => (
              <span
                key={type}
                onClick={() => {
                  if (suppressPaletteClick.current) {
                    suppressPaletteClick.current = false
                    return
                  }
                  addBlock(type)
                }}
              >
                <EmailStudioPaletteChip type={type} />
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Drag a block onto the page, or click it to add it. Click any text on the page to rewrite it.</p>
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
            ) : (
              <span className="text-xs text-muted-foreground">Edits here are what download and Klaviyo use.</span>
            )}
          </div>
          {mode === "display" && customHtml ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-border bg-background px-3 py-2 text-xs">
                <span>Showing your edited HTML.</span>
                <button
                  type="button"
                  className="font-medium text-[#355185] hover:underline"
                  onClick={() => patch({ document: { ...draft.document, htmlOverride: null } })}
                >
                  Back to page editing
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-4">
                <iframe title="Email display" sandbox="" srcDoc={html} style={{ width: frameWidth }} className="mx-auto block h-[720px] max-w-full rounded-md border border-border bg-white shadow-sm" />
              </div>
            </div>
          ) : null}
          {mode === "display" && !customHtml ? (
            <EmailStudioCanvas
              blocks={draft.document.blocks}
              selectedId={selectedId}
              width={frameWidth}
              onSelect={setSelectedId}
              onChange={(block) => updateBlocks(draft.document.blocks.map((item) => (item.id === block.id ? block : item)))}
              onRemove={(id) => {
                const index = draft.document.blocks.findIndex((item) => item.id === id)
                updateBlocks(draft.document.blocks.filter((item) => item.id !== id))
                if (selectedId === id) setSelectedId(draft.document.blocks[index + 1]?.id ?? draft.document.blocks[index - 1]?.id ?? null)
              }}
              onDuplicate={(id) => {
                const index = draft.document.blocks.findIndex((item) => item.id === id)
                const source = draft.document.blocks[index]
                if (!source) return
                const copy = source.type === "details"
                  ? { ...source, id: emailBlockId(), rows: source.rows.map((row) => ({ ...row, id: emailBlockId() })) }
                  : { ...source, id: emailBlockId() }
                const blocks = [...draft.document.blocks]
                blocks.splice(index + 1, 0, copy)
                updateBlocks(blocks)
                setSelectedId(copy.id)
              }}
            />
          ) : null}
          {mode === "code" ? (
            <textarea
              value={draft.document.htmlOverride ?? generatedHtml}
              aria-label="Email HTML"
              spellCheck={false}
              className="min-h-0 flex-1 resize-none bg-[#0F172A] p-4 font-mono text-xs leading-5 text-[#E2E8F0]"
              onChange={(event) => {
                const value = event.target.value
                patch({
                  document: {
                    ...draft.document,
                    htmlOverride: value === generatedHtml ? null : value,
                  },
                })
              }}
            />
          ) : null}
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
        {assistantOpen ? (
          <aside className="min-h-[280px] border-t border-border p-3 lg:border-l lg:border-t-0">
            <EmailStudioAssistant
              scope="email"
              scopeId={draft.id}
              enabled={assistantEnabled}
              initialMessages={messages}
              snapshot={JSON.stringify({
                name: draft.name,
                subject: draft.subject,
                previewText: draft.previewText,
                triggerMetric: draft.triggerMetric,
                notes: draft.notes,
                blocks: draft.document.blocks,
              })}
              onEmail={(email) => patch({
                subject: email.subject,
                previewText: email.previewText,
                notes: email.notes,
                document: email.document,
              })}
            />
          </aside>
        ) : null}
      </div>
      <DragOverlay>
        {draggingLabel ? (
          <div className="rounded-md border border-border bg-white px-3 py-2 text-xs shadow-md">{draggingLabel}</div>
        ) : null}
      </DragOverlay>
      </DndContext>
    </div>
  )
}
