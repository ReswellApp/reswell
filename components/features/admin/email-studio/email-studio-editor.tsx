"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { MouseEvent as ReactMouseEvent } from "react"
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
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Redo2, Undo2 } from "lucide-react"
import { toast } from "sonner"
import {
  pushEmailStudioToKlaviyoAction,
  saveEmailStudioTemplateAction,
  sendEmailStudioTestAction,
} from "@/lib/actions/emailStudio"
import { cloneEmailBlock, createEmailBlock } from "@/lib/email-studio/document"
import { createEmailFrame, EMAIL_STUDIO_FRAMES, isEmailStudioFrameId, type EmailStudioFrameId } from "@/lib/email-studio/frames"
import { findEmailBlock, replaceEmailBlock } from "@/lib/email-studio/document-tree"
import {
  renderEmailStudioHtml,
  resolveEmailStudioHtml,
  withEmailPreviewSamples,
} from "@/lib/email-studio/render-html"
import { KNOWN_KLAVIYO_METRIC_NAMES } from "@/lib/klaviyo/event-log-shared"
import type {
  EmailBlockType,
  EmailStudioDocument,
  EmailStudioFlowOption,
  EmailStudioRecord,
} from "@/lib/types/emailStudio"
import type { EmailStudioAssistantProposalPreview } from "@/lib/types/emailStudioCommands"
import type { EmailStudioMessage } from "@/lib/types/emailStudioFlow"
import { EmailStudioAssistant } from "@/components/features/admin/email-studio/email-studio-assistant"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmailStudioCanvas, EmailStudioPaletteChip } from "@/components/features/admin/email-studio/email-studio-canvas"
import { EmailStudioFrameChip } from "@/components/features/admin/email-studio/email-studio-frame-library"
import { EmailStudioInspector } from "@/components/features/admin/email-studio/email-studio-inspector"
import {
  EmailStudioOutlineRow,
  emailBlockLabel,
  emailBlockSummary,
} from "@/components/features/admin/email-studio/email-studio-outline"
import { EmailStudioVersionHistory } from "@/components/features/admin/email-studio/email-studio-version-history"
import { useEmailStudioDocument } from "@/components/features/admin/email-studio/hooks/use-email-studio-document"

const ADDABLE: EmailBlockType[] = [
  "section",
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
  pendingProposal,
}: {
  project: EmailStudioRecord
  flows: EmailStudioFlowOption[]
  klaviyoConnected: boolean
  assistantEnabled: boolean
  messages: EmailStudioMessage[]
  pendingProposal: Extract<EmailStudioAssistantProposalPreview, { scope: "email" }> | null
}) {
  const router = useRouter()
  const {
    draft,
    patch,
    save,
    dirty,
    saving,
    saveError,
    conflict,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    mergeServerFields,
    getCurrent,
  } = useEmailStudioDocument(project)
  const [selectedId, setSelectedId] = useState(
    pendingProposal?.email.document.blocks[0]?.id ?? project.document.blocks[0]?.id ?? null,
  )
  const [mode, setMode] = useState<"display" | "preview" | "code">("display")
  const [frameWidth, setFrameWidth] = useState<375 | 600>(600)
  const [templateName, setTemplateName] = useState("")
  const [testRecipient, setTestRecipient] = useState("")
  const [testSending, setTestSending] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(true)
  const [proposalPreview, setProposalPreview] = useState<{
    subject: string
    previewText: string
    notes: string
    document: EmailStudioDocument
  } | null>(pendingProposal?.email ?? null)
  const [draggingLabel, setDraggingLabel] = useState<string | null>(null)
  const suppressPaletteClick = useRef(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const displayDraft = proposalPreview ? { ...draft, ...proposalPreview } : draft
  const renderInput = useMemo(
    () => ({
      name: displayDraft.name,
      subject: displayDraft.subject,
      previewText: displayDraft.previewText,
      flowName: displayDraft.flowName,
      triggerMetric: displayDraft.triggerMetric,
      document: displayDraft.document,
    }),
    [displayDraft],
  )
  const generatedHtml = useMemo(() => renderEmailStudioHtml(renderInput), [renderInput])
  const html = useMemo(() => resolveEmailStudioHtml(renderInput), [renderInput])
  const previewHtml = useMemo(() => withEmailPreviewSamples(html), [html])
  const customHtml = Boolean(displayDraft.document.htmlOverride?.trim())
  const selected = findEmailBlock(displayDraft.document, selectedId)?.block ?? null
  const klaviyoStale = Boolean(
    draft.klaviyoTemplateId
    && (dirty || draft.klaviyoSyncedRevision !== draft.revision),
  )

  function updateBlocks(blocks: EmailStudioRecord["document"]["blocks"]) {
    if (proposalPreview) return
    if (draft.document.htmlOverride) {
      toast.message("Page edit replaced the custom HTML.")
    }
    patch({ document: { blocks, htmlOverride: null } }, "blocks")
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault()
        void save({ announce: true, flush: true })
        return
      }
      const target = event.target as HTMLElement | null
      const editing = target?.matches("input, textarea, [contenteditable='true']")
      if (!mod || editing) return
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

  const collision: CollisionDetection = (args) => {
    const hits = pointerWithin(args)
    return hits.length > 0 ? hits : closestCenter(args)
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingLabel(null)
    if (proposalPreview) return
    const { active, over } = event
    if (!over) return
    const rawActiveId = String(active.id)
    const rawOverId = String(over.id)
    const activeId = rawActiveId.startsWith("outline:") ? rawActiveId.slice("outline:".length) : rawActiveId
    const overId = rawOverId.startsWith("outline:") ? rawOverId.slice("outline:".length) : rawOverId
    if (activeId.startsWith("frame:")) {
      const frameId = activeId.slice("frame:".length)
      if (!isEmailStudioFrameId(frameId)) return
      const block = createEmailFrame(frameId)
      const blocks = [...draft.document.blocks]
      const index = blocks.findIndex((item) => item.id === overId)
      blocks.splice(overId === "canvas-end" || index < 0 ? blocks.length : index, 0, block)
      updateBlocks(blocks)
      setSelectedId(block.id)
      return
    }
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

  function insertFrame(frameId: EmailStudioFrameId) {
    if (proposalPreview) return
    const block = createEmailFrame(frameId)
    const blocks = [...draft.document.blocks]
    const index = blocks.findIndex((item) => item.id === selectedId)
    blocks.splice(index >= 0 ? index + 1 : blocks.length, 0, block)
    updateBlocks(blocks)
    setSelectedId(block.id)
  }

  function addBlock(type: EmailBlockType) {
    if (proposalPreview) return
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
    const ok = dirty ? await save({ flush: true }) : true
    if (!ok) return
    const result = await pushEmailStudioToKlaviyoAction({ id: draft.id })
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    mergeServerFields({
      klaviyoTemplateId: result.templateId,
      klaviyoSyncedRevision: result.syncedRevision,
      klaviyoContentChecksum: result.checksum,
      klaviyoSyncedAt: result.syncedAt,
    })
    if (result.warning) toast.warning(result.warning)
    else toast.success("Template is verified in Klaviyo.")
  }

  async function saveTemplate() {
    const name = templateName.trim()
    if (!name) {
      toast.error("Name the template")
      return
    }
    const ok = dirty ? await save({ flush: true }) : true
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

  async function sendTest(): Promise<void> {
    const ok = await save({ flush: true })
    if (!ok) return
    setTestSending(true)
    const result = await sendEmailStudioTestAction({
      id: draft.id,
      recipient: testRecipient,
    })
    setTestSending(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    toast.success(`Test queued for ${testRecipient}`)
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
          <Link href="/admin/email-studio" onClick={(event) => navigateAfterSave(event, "/admin/email-studio")}>Projects</Link>
        </Button>
        <Input
          value={draft.name}
          aria-label="Project name"
          disabled={Boolean(proposalPreview)}
          className="h-9 max-w-xs"
          onChange={(event) => patch({ name: event.target.value }, "meta:name")}
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
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Reload
            </Button>
          ) : null}
          <Button size="icon" variant="ghost" aria-label="Undo" disabled={!canUndo} onClick={undo}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Redo" disabled={!canRedo} onClick={redo}>
            <Redo2 className="h-4 w-4" />
          </Button>
          <EmailStudioVersionHistory
            scope="email"
            scopeId={draft.id}
            currentRevision={draft.revision}
            onRestored={reset}
          />
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
            <Link href="/admin/email-studio/flows" onClick={(event) => navigateAfterSave(event, "/admin/email-studio/flows")}>Flows</Link>
          </Button>
          <Button size="sm" variant="outline" disabled={!klaviyoConnected || saving || Boolean(proposalPreview)} onClick={() => void pushKlaviyo()}>
            {!klaviyoConnected
              ? "Klaviyo key missing"
              : draft.klaviyoTemplateId
                ? klaviyoStale
                  ? "Update Klaviyo"
                  : "Synced to Klaviyo"
                : "Push to Klaviyo"}
          </Button>
          <Button size="sm" disabled={saving || conflict} onClick={() => void save({ announce: true, flush: true })}>
            {saving ? "Saving" : "Save now"}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 border-b border-border px-3 py-2 md:grid-cols-4">
        <Input value={displayDraft.subject} disabled={Boolean(proposalPreview)} placeholder="Subject" aria-label="Subject" onChange={(event) => patch({ subject: event.target.value }, "meta:subject")} />
        <Input value={displayDraft.previewText} disabled={Boolean(proposalPreview)} placeholder="Preview text" aria-label="Preview text" onChange={(event) => patch({ previewText: event.target.value }, "meta:preview")} />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Trigger metric"
          disabled={Boolean(proposalPreview)}
          value={draft.triggerMetric}
          onChange={(event) => patch({ triggerMetric: event.target.value }, "meta:trigger")}
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
          disabled={Boolean(proposalPreview)}
          value={draft.flowId}
          onChange={(event) => {
            const flow = flows.find((item) => item.id === event.target.value)
            patch({ flowId: event.target.value, flowName: flow?.name ?? draft.flowName }, "meta:flow")
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
          if (id.startsWith("frame:")) {
            const frame = EMAIL_STUDIO_FRAMES.find((item) => item.id === id.slice("frame:".length))
            setDraggingLabel(frame?.name ?? "Frame")
            return
          }
          setDraggingLabel(id.startsWith("palette:") ? emailBlockLabel(id.slice("palette:".length) as EmailBlockType) : "Block")
        }}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDraggingLabel(null)}
      >
      <div className={`grid min-h-0 flex-1 ${assistantOpen ? "lg:grid-cols-[240px_minmax(0,1fr)_280px_360px]" : "lg:grid-cols-[240px_minmax(0,1fr)_300px]"}`}>
        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-b border-border p-3 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Layers</p>
            <span className="text-[11px] text-muted-foreground">{draft.document.blocks.length}</span>
          </div>
          <SortableContext
            items={draft.document.blocks.map((block) => `outline:${block.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {draft.document.blocks.map((block, index) => (
                <div key={block.id} className="space-y-1">
                  <EmailStudioOutlineRow
                    block={block}
                    sortableId={`outline:${block.id}`}
                    active={block.id === selectedId}
                    onSelect={() => setSelectedId(block.id)}
                    onRemove={() => {
                      updateBlocks(draft.document.blocks.filter((item) => item.id !== block.id))
                      if (selectedId === block.id) {
                        setSelectedId(
                          draft.document.blocks[index + 1]?.id
                            ?? draft.document.blocks[index - 1]?.id
                            ?? null,
                        )
                      }
                    }}
                    onMove={(direction) => {
                      const target = index + direction
                      if (target < 0 || target >= draft.document.blocks.length) return
                      updateBlocks(arrayMove(draft.document.blocks, index, target))
                    }}
                  />
                  {block.type === "section" ? (
                    <div className="space-y-1 border-l border-border pl-3">
                      {block.columns.flatMap((column) => column.blocks).map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          className={`w-full rounded px-2 py-1 text-left text-xs ${child.id === selectedId ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"}`}
                          onClick={() => setSelectedId(child.id)}
                        >
                          <span className="font-medium">{emailBlockLabel(child.type)}</span>
                          {emailBlockSummary(child) ? ` · ${emailBlockSummary(child)}` : ""}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </SortableContext>
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Frames</p>
            <div className="grid grid-cols-2 gap-1.5">
              {EMAIL_STUDIO_FRAMES.map((frame) => (
                <span
                  key={frame.id}
                  onClick={() => {
                    if (suppressPaletteClick.current) {
                      suppressPaletteClick.current = false
                      return
                    }
                    insertFrame(frame.id)
                  }}
                >
                  <EmailStudioFrameChip id={frame.id} />
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Drop a frame on the artboard, then edit the type in place.</p>
          </div>
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Blocks</p>
          </div>
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
          <p className="text-xs text-muted-foreground">Drag a block onto the artboard. Select a layer to edit it.</p>
        </aside>

        <section className="flex min-h-[420px] min-w-0 flex-col bg-[#F9F9F2]">
          <div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2">
            <div className="inline-flex rounded-md border border-border p-0.5">
              <button type="button" className={`rounded px-3 py-1 text-sm ${mode === "display" ? "bg-foreground text-background" : ""}`} onClick={() => setMode("display")}>Display</button>
              <button type="button" className={`rounded px-3 py-1 text-sm ${mode === "preview" ? "bg-foreground text-background" : ""}`} onClick={() => setMode("preview")}>Preview</button>
              <button type="button" className={`rounded px-3 py-1 text-sm ${mode === "code" ? "bg-foreground text-background" : ""}`} onClick={() => setMode("code")}>Code</button>
            </div>
            {mode !== "code" ? (
              <div className="inline-flex rounded-md border border-border p-0.5">
                <button type="button" className={`rounded px-2 py-1 text-xs ${frameWidth === 600 ? "bg-muted" : ""}`} onClick={() => setFrameWidth(600)}>Desktop</button>
                <button type="button" className={`rounded px-2 py-1 text-xs ${frameWidth === 375 ? "bg-muted" : ""}`} onClick={() => setFrameWidth(375)}>Phone</button>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Preview, download, and Klaviyo use this HTML in Reswell colors and Stack Sans.</span>
            )}
          </div>
          {proposalPreview ? (
            <div className="border-b border-[#5574AD]/30 bg-[#5574AD]/5 px-3 py-2 text-xs text-[#355185]">
              Assistant preview · Accept or reject it in the assistant panel.
            </div>
          ) : null}
          {mode === "display" && customHtml ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-border bg-background px-3 py-2 text-xs">
                <span>Showing your edited HTML.</span>
                <button
                  type="button"
                  disabled={Boolean(proposalPreview)}
                  className="font-medium text-[#355185] hover:underline"
                  onClick={() => patch({ document: { ...draft.document, htmlOverride: null } }, "code-mode")}
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
              blocks={displayDraft.document.blocks}
              selectedId={selectedId}
              width={frameWidth}
              onSelect={setSelectedId}
              onChange={(block) => updateBlocks(displayDraft.document.blocks.map((item) => (item.id === block.id ? block : item)))}
              onRemove={(id) => {
                const index = displayDraft.document.blocks.findIndex((item) => item.id === id)
                updateBlocks(displayDraft.document.blocks.filter((item) => item.id !== id))
                if (selectedId === id) setSelectedId(displayDraft.document.blocks[index + 1]?.id ?? displayDraft.document.blocks[index - 1]?.id ?? null)
              }}
              onDuplicate={(id) => {
                const index = displayDraft.document.blocks.findIndex((item) => item.id === id)
                const source = displayDraft.document.blocks[index]
                if (!source) return
                const copy = cloneEmailBlock(source)
                const blocks = [...displayDraft.document.blocks]
                blocks.splice(index + 1, 0, copy)
                updateBlocks(blocks)
                setSelectedId(copy.id)
              }}
            />
          ) : null}
          {mode === "preview" ? (
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <iframe
                title="Rendered email preview"
                sandbox=""
                srcDoc={previewHtml}
                style={{ width: frameWidth }}
                className="mx-auto block h-[720px] max-w-full rounded-md border border-border bg-white"
              />
            </div>
          ) : null}
          {mode === "code" ? (
            <textarea
              value={draft.document.htmlOverride ?? generatedHtml}
              aria-label="Email HTML"
              spellCheck={false}
              disabled={Boolean(proposalPreview)}
              className="min-h-0 flex-1 resize-none bg-[#0F172A] p-4 font-mono text-xs leading-5 text-[#E2E8F0]"
              onChange={(event) => {
                const value = event.target.value
                patch({
                  document: {
                    ...draft.document,
                    htmlOverride: value === generatedHtml ? null : value,
                  },
                }, "code")
              }}
            />
          ) : null}
        </section>

        <aside className="min-h-0 overflow-y-auto border-t border-border p-3 lg:border-l lg:border-t-0">
          {proposalPreview ? (
            <p className="text-sm text-muted-foreground">Resolve the assistant proposal before editing properties.</p>
          ) : (
            <EmailStudioInspector
              block={selected}
              onChange={(block) => {
                if (proposalPreview) return
                patch({ document: replaceEmailBlock(draft.document, block) }, "blocks")
              }}
            />
          )}
          <div className="mt-6 space-y-2 border-t border-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Save as template</p>
            <Input
              value={templateName}
              placeholder="Template name"
              disabled={Boolean(proposalPreview)}
              onChange={(event) => setTemplateName(event.target.value)}
            />
            <Button size="sm" variant="outline" disabled={Boolean(proposalPreview)} onClick={() => void saveTemplate()}>Save template</Button>
            <p className="text-xs text-muted-foreground">
              Push stores a code template in Klaviyo. It does not turn a flow on. Download HTML if the key is unavailable.
            </p>
            {draft.klaviyoTemplateId ? (
              <p className="break-all text-xs text-muted-foreground">
                Klaviyo template {draft.klaviyoTemplateId}
                {klaviyoStale ? " · Local changes not pushed" : " · Up to date"}
              </p>
            ) : null}
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Test send</p>
              <Input
                type="email"
                value={testRecipient}
                placeholder="you@reswell.app"
                disabled={!klaviyoConnected || testSending}
                onChange={(event) => setTestRecipient(event.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!klaviyoConnected || !testRecipient.trim() || testSending || Boolean(proposalPreview)}
                onClick={() => void sendTest()}
              >
                {testSending ? "Sending…" : "Send test"}
              </Button>
            </div>
            <label className="block text-xs text-muted-foreground">
              Notes
              <textarea
                value={draft.notes}
                disabled={Boolean(proposalPreview)}
                className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm text-foreground"
                onChange={(event) => patch({ notes: event.target.value }, "meta:notes")}
              />
            </label>
            {!draft.flowId ? (
              <Input
                value={draft.flowName}
                disabled={Boolean(proposalPreview)}
                placeholder="Flow name if it is not in the list"
                onChange={(event) => patch({ flowName: event.target.value }, "meta:flow-name")}
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
              initialProposal={pendingProposal}
              baseRevision={draft.revision}
              snapshot={JSON.stringify({
                name: draft.name,
                subject: draft.subject,
                previewText: draft.previewText,
                triggerMetric: draft.triggerMetric,
                notes: draft.notes,
                blocks: draft.document.blocks,
              })}
              prepare={async () => {
                const saved = await save({ flush: true })
                if (!saved) return null
                const current = getCurrent()
                return {
                  baseRevision: current.revision,
                  ...(selectedId ? { selectedBlockId: selectedId } : {}),
                  snapshot: JSON.stringify({
                    name: current.name,
                    subject: current.subject,
                    previewText: current.previewText,
                    triggerMetric: current.triggerMetric,
                    notes: current.notes,
                    blocks: current.document.blocks,
                    selectedBlockId: selectedId,
                  }),
                }
              }}
              onEmailPreview={(email) => {
                setProposalPreview(email)
                if (email && !email.document.blocks.some((block) => block.id === selectedId)) {
                  setSelectedId(email.document.blocks[0]?.id ?? null)
                }
                if (!email && !draft.document.blocks.some((block) => block.id === selectedId)) {
                  setSelectedId(draft.document.blocks[0]?.id ?? null)
                }
              }}
              onEmailAccepted={(record) => {
                setProposalPreview(null)
                reset(record)
                setSelectedId(record.document.blocks[0]?.id ?? null)
              }}
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
