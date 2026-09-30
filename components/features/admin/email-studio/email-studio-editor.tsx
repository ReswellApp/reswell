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
import {
  ArrowLeft,
  Copy,
  Download,
  Monitor,
  Redo2,
  Send,
  Smartphone,
  Sparkles,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"
import {
  saveEmailStudioTemplateAction,
  sendEmailStudioTestAction,
} from "@/lib/actions/emailStudio"
import { createEmailBlock } from "@/lib/email-studio/document"
import { createEmailFrame, EMAIL_STUDIO_FRAMES, isEmailStudioFrameId, type EmailStudioFrameId } from "@/lib/email-studio/frames"
import { duplicateEmailBlock, findEmailBlock, insertEmailBlockAfter, removeEmailBlock, replaceEmailBlock } from "@/lib/email-studio/document-tree"
import {
  renderEmailStudioHtml,
  resolveEmailStudioHtml,
} from "@/lib/email-studio/render-html"
import type { EmailStudioPublishResult } from "@/lib/email-studio/publish-result"
import { KNOWN_KLAVIYO_METRIC_NAMES } from "@/lib/klaviyo/event-log-shared"
import type {
  EmailBlockType,
  EmailStudioDocument,
  EmailStudioFlowOption,
  EmailStudioRecord,
} from "@/lib/types/emailStudio"
import type { EmailStudioAssistantProposalPreview } from "@/lib/types/emailStudioCommands"
import type { EmailStudioMessage } from "@/lib/types/emailStudioFlow"
import { cn } from "@/lib/utils"
import { EmailStudioAssistant } from "@/components/features/admin/email-studio/email-studio-assistant"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { EmailStudioCanvas } from "@/components/features/admin/email-studio/email-studio-canvas"
import { EmailStudioInspector } from "@/components/features/admin/email-studio/email-studio-inspector"
import { EmailStudioRail, type EmailStudioRailTab } from "@/components/features/admin/email-studio/email-studio-rail"
import {
  EmailStudioOutlineRow,
  emailBlockLabel,
  emailBlockSummary,
} from "@/components/features/admin/email-studio/email-studio-outline"
import { EmailStudioVersionHistory } from "@/components/features/admin/email-studio/email-studio-version-history"
import { EmailStudioLivePreview } from "@/components/features/admin/email-studio/email-studio-live-preview"
import { EmailStudioReviewPublish } from "@/components/features/admin/email-studio/email-studio-review-publish"
import { useEmailStudioDocument } from "@/components/features/admin/email-studio/hooks/use-email-studio-document"

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
  const [selectedId, setSelectedId] = useState<string | null>(
    pendingProposal?.email.document.blocks[0]?.id ?? null,
  )
  const [mode, setMode] = useState<"display" | "preview" | "code">("display")
  const [frameWidth, setFrameWidth] = useState<375 | 600>(600)
  const [templateName, setTemplateName] = useState("")
  const [reviewOpen, setReviewOpen] = useState(false)
  const [rail, setRail] = useState<EmailStudioRailTab>(pendingProposal ? "assistant" : "content")
  const [railOpen, setRailOpen] = useState(true)
  const [inspecting, setInspecting] = useState(false)
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
      if (event.key === "Escape" && !editing) {
        if (mode === "preview") {
          setMode("display")
          return
        }
        setSelectedId(null)
        setInspecting(false)
        return
      }
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
      selectBlock(block.id)
      return
    }
    if (activeId.startsWith("palette:")) {
      const type = activeId.slice("palette:".length) as EmailBlockType
      const block = createEmailBlock(type)
      const blocks = [...draft.document.blocks]
      const index = blocks.findIndex((item) => item.id === overId)
      blocks.splice(overId === "canvas-end" || index < 0 ? blocks.length : index, 0, block)
      updateBlocks(blocks)
      selectBlock(block.id)
      return
    }
    if (activeId === overId) return
    const ids = draft.document.blocks.map((block) => block.id)
    const from = ids.indexOf(activeId)
    const to = overId === "canvas-end" ? ids.length - 1 : ids.indexOf(overId)
    if (from < 0 || to < 0) return
    updateBlocks(arrayMove(draft.document.blocks, from, to))
  }

  function selectBlock(id: string | null) {
    setSelectedId(id)
    setInspecting(Boolean(id))
    if (id) setRailOpen(true)
  }

  function insertFrame(frameId: EmailStudioFrameId) {
    if (proposalPreview) return
    const block = createEmailFrame(frameId)
    const blocks = [...draft.document.blocks]
    const index = blocks.findIndex((item) => item.id === selectedId)
    blocks.splice(index >= 0 ? index + 1 : blocks.length, 0, block)
    updateBlocks(blocks)
    selectBlock(block.id)
  }

  function removeBlock(id: string) {
    if (proposalPreview) return
    const location = findEmailBlock(displayDraft.document, id)
    if (!location) return
    let nextId: string | null = selectedId
    if (selectedId === id) {
      if (location.sectionId && location.columnId && location.childIndex !== null) {
        const section = displayDraft.document.blocks[location.topLevelIndex]
        const column = section?.type === "section"
          ? section.columns.find((item) => item.id === location.columnId)
          : undefined
        nextId = column?.blocks[location.childIndex + 1]?.id
          ?? column?.blocks[location.childIndex - 1]?.id
          ?? section?.id
          ?? null
      } else {
        nextId = displayDraft.document.blocks[location.topLevelIndex + 1]?.id
          ?? displayDraft.document.blocks[location.topLevelIndex - 1]?.id
          ?? null
      }
    }
    updateBlocks(removeEmailBlock(displayDraft.document, id).blocks)
    if (selectedId === id) selectBlock(nextId)
  }

  function duplicateBlock(id: string) {
    if (proposalPreview) return
    try {
      const result = duplicateEmailBlock(displayDraft.document, id)
      updateBlocks(result.document.blocks)
      selectBlock(result.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not duplicate that block")
    }
  }

  function insertBlock(afterId: string, type: EmailBlockType) {
    if (proposalPreview) return
    try {
      const block = createEmailBlock(type)
      updateBlocks(insertEmailBlockAfter(displayDraft.document, afterId, block).blocks)
      selectBlock(block.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add that block")
    }
  }

  function addBlock(type: EmailBlockType) {
    if (proposalPreview) return
    const block = createEmailBlock(type)
    const blocks = [...draft.document.blocks]
    const index = blocks.findIndex((item) => item.id === selectedId)
    blocks.splice(index >= 0 ? index + 1 : blocks.length, 0, block)
    updateBlocks(blocks)
    selectBlock(block.id)
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

  async function reviewAndPublish(recipient: string): Promise<EmailStudioPublishResult> {
    const ok = await save({ flush: true })
    if (!ok) return { status: "error", message: "Save the email before publishing." }
    const test = await sendEmailStudioTestAction({
      id: draft.id,
      recipient,
    })
    if ("error" in test) {
      return { status: "error", message: test.error }
    }
    mergeServerFields({
      klaviyoTemplateId: test.templateId,
      klaviyoSyncedRevision: test.syncedRevision,
      klaviyoContentChecksum: test.checksum,
      klaviyoSyncedAt: test.syncedAt,
    })
    router.refresh()
    if (test.warning) {
      return {
        status: "warning",
        message: `Test queued for ${recipient}. ${test.warning}`,
      }
    }
    toast.success("Test queued and approved version published.")
    return { status: "success", message: `Test queued for ${recipient}. Approved version verified in Klaviyo.` }
  }

  function navigateAfterSave(event: ReactMouseEvent<HTMLAnchorElement>, href: string): void {
    if (!dirty) return
    event.preventDefault()
    void save({ flush: true }).then((saved) => {
      if (saved) router.push(href)
    })
  }

  const headerAction = "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-[#3f3f46] hover:bg-[#f4f4f5]"
  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-[#18181b] [--background:0_0%_100%] [--foreground:222_56%_3.5%] [--border:214_32%_91%] [--input:213_27%_84%] [--muted:210_40%_98%] [--muted-foreground:215_16%_47%] [--primary:222_56%_3.5%] [--primary-foreground:0_0%_100%] [--popover:0_0%_100%] [--popover-foreground:222_56%_3.5%] [--ring:222_56%_3.5%]">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-[#e4e4e7] bg-white px-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href="/admin/email-studio" aria-label="Back to Email Studio" onClick={(event) => navigateAfterSave(event, "/admin/email-studio")}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="mx-1 hidden h-5 w-px bg-[#e4e4e7] sm:block" />
        <Input
          value={draft.name}
          aria-label="Project name"
          disabled={Boolean(proposalPreview)}
          className="h-8 min-w-[9rem] max-w-72 flex-1 border-transparent bg-transparent px-2 text-sm font-medium text-[#18181b] shadow-none hover:border-[#e4e4e7] focus:border-[#e4e4e7]"
          onChange={(event) => patch({ name: event.target.value }, "meta:name")}
        />
        <span
          className={cn("hidden truncate text-[11px] sm:inline", conflict || saveError ? "text-destructive" : "text-[#71717a]")}
          title={saveError ?? undefined}
        >
          {conflict
            ? "Save conflict"
            : saving
              ? "Saving…"
              : saveError
                ? "Autosave paused"
                : dirty
                  ? "Unsaved"
                  : `Saved · v${draft.revision}`}
        </span>
        {conflict ? (
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Reload
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            className={cn(headerAction, reviewOpen && "bg-[#f4f4f5] text-[#18181b]")}
            disabled={Boolean(proposalPreview)}
            onClick={() => setReviewOpen(true)}
          >
            <Send className="h-4 w-4" />
            <span className="hidden lg:inline">Review & publish</span>
          </button>
          <button
            type="button"
            className={cn(headerAction, rail === "assistant" && railOpen && !inspecting && "bg-[#f4f4f5] text-[#18181b]")}
            onClick={() => {
              setRail("assistant")
              setInspecting(false)
              setRailOpen(true)
            }}
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden md:inline">AI</span>
          </button>
          <EmailStudioVersionHistory
            compact
            scope="email"
            scopeId={draft.id}
            currentRevision={draft.revision}
            onRestored={(record) => {
              reset(record)
              setInspecting(false)
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e4e4e7] bg-white px-2.5 text-sm text-[#18181b] hover:bg-[#f4f4f5]">
                <Download className="h-4 w-4" />
                <span className="hidden md:inline">Export</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={download}>Download HTML</DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  void navigator.clipboard.writeText(html)
                  toast.success("HTML copied")
                }}
              >
                <Copy className="h-4 w-4" />
                Copy HTML
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/email-studio/flows" onClick={(event) => navigateAfterSave(event, "/admin/email-studio/flows")}>
                  Flows
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="ml-1 h-8 rounded-md bg-[#18181b] px-3 text-white hover:bg-black" disabled={saving || conflict} onClick={() => void save({ announce: true, flush: true })}>
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </header>

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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-h-[320px] min-w-0 flex-1 flex-col bg-[#e6e6e6]">
          <div className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-[#e4e4e7] bg-[#f6f6f6] px-3">
            <div className="flex items-center gap-0.5">
              <button type="button" aria-label="Undo" disabled={!canUndo} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#3f3f46] hover:bg-white disabled:opacity-30" onClick={undo}>
                <Undo2 className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Redo" disabled={!canRedo} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#3f3f46] hover:bg-white disabled:opacity-30" onClick={redo}>
                <Redo2 className="h-4 w-4" />
              </button>
            </div>
            <div className="inline-flex rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-black/5">
              {([
                ["display", "Design"],
                ["preview", "Preview"],
                ["code", "Code"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium",
                    mode === value ? "bg-[#18181b] text-white" : "text-[#3f3f46] hover:bg-[#f4f4f5]",
                  )}
                  onClick={() => setMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              {mode === "code" ? (
                <span className="hidden text-[11px] text-[#71717a] lg:inline">Export uses this HTML.</span>
              ) : (
                <div className="inline-flex rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-black/5">
                  <button type="button" aria-label="Desktop canvas" className={cn("inline-flex h-7 w-8 items-center justify-center rounded-md", frameWidth === 600 ? "bg-[#f4f4f5] text-[#18181b]" : "text-[#71717a]")} onClick={() => setFrameWidth(600)}>
                    <Monitor className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label="Mobile canvas" className={cn("inline-flex h-7 w-8 items-center justify-center rounded-md", frameWidth === 375 ? "bg-[#f4f4f5] text-[#18181b]" : "text-[#71717a]")} onClick={() => setFrameWidth(375)}>
                    <Smartphone className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
          {proposalPreview ? (
            <div className="border-b border-[#5574AD]/30 bg-[#5574AD]/5 px-3 py-2 text-xs text-[#355185]">
              Assistant preview · Accept or reject it in the assistant panel.
            </div>
          ) : null}
          {mode === "display" && customHtml ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-[#e4e4e7] bg-white px-3 py-2 text-xs">
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
              <div className="min-h-0 flex-1 overflow-auto bg-[#e6e6e6] p-8">
                <iframe title="Email display" sandbox="" srcDoc={html} style={{ width: frameWidth }} className="mx-auto block h-[720px] max-w-full bg-white shadow-[0_18px_50px_rgba(15,23,42,0.14)]" />
              </div>
            </div>
          ) : null}
          {mode === "display" && !customHtml ? (
            <EmailStudioCanvas
              blocks={displayDraft.document.blocks}
              selectedId={selectedId}
              width={frameWidth}
              onSelect={selectBlock}
              onClear={() => selectBlock(null)}
              onChange={(block) => updateBlocks(displayDraft.document.blocks.map((item) => (item.id === block.id ? block : item)))}
              onRemove={removeBlock}
              onDuplicate={duplicateBlock}
              onInsert={insertBlock}
            />
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

        <EmailStudioRail
          tab={rail}
          open={railOpen}
          inspecting={inspecting && Boolean(selected)}
          selectedLabel={selected ? (selected.type === "section" ? "Row" : emailBlockLabel(selected.type)) : "Block"}
          locked={Boolean(proposalPreview)}
          paletteGuard={suppressPaletteClick}
          blockCount={draft.document.blocks.length}
          onTab={(next) => {
            setRail(next)
            setInspecting(false)
            setRailOpen(true)
          }}
          onOpenChange={setRailOpen}
          onBack={() => selectBlock(null)}
          onRemove={() => {
            if (selected) removeBlock(selected.id)
          }}
          onDuplicate={() => {
            if (selected) duplicateBlock(selected.id)
          }}
          onAddBlock={addBlock}
          onInsertFrame={insertFrame}
          properties={proposalPreview ? (
            <p className="text-sm text-[#71717a]">Resolve the assistant proposal before editing properties.</p>
          ) : (
            <EmailStudioInspector
              block={selected}
              onChange={(block) => {
                if (proposalPreview) return
                patch({ document: replaceEmailBlock(draft.document, block) }, "blocks")
              }}
            />
          )}
          settings={(
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717a]">Inbox</p>
                <label className="block space-y-1.5 text-xs font-medium">
                  Subject
                  <Input value={displayDraft.subject} disabled={Boolean(proposalPreview)} placeholder="Email subject" onChange={(event) => patch({ subject: event.target.value }, "meta:subject")} />
                </label>
                <label className="block space-y-1.5 text-xs font-medium">
                  Preview text
                  <Input value={displayDraft.previewText} disabled={Boolean(proposalPreview)} placeholder="Inbox preview" onChange={(event) => patch({ previewText: event.target.value }, "meta:preview")} />
                </label>
                <label className="block space-y-1.5 text-xs font-medium">
                  Trigger metric
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal" disabled={Boolean(proposalPreview)} value={draft.triggerMetric} onChange={(event) => patch({ triggerMetric: event.target.value }, "meta:trigger")}>
                    <option value="">Choose a metric</option>
                    {KNOWN_KLAVIYO_METRIC_NAMES.map((metric) => <option key={metric} value={metric}>{metric}</option>)}
                    {draft.triggerMetric && !KNOWN_KLAVIYO_METRIC_NAMES.includes(draft.triggerMetric) ? <option value={draft.triggerMetric}>{draft.triggerMetric}</option> : null}
                  </select>
                </label>
                <label className="block space-y-1.5 text-xs font-medium">
                  Klaviyo flow
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal"
                    disabled={Boolean(proposalPreview)}
                    value={draft.flowId}
                    onChange={(event) => {
                      const flow = flows.find((item) => item.id === event.target.value)
                      patch({ flowId: event.target.value, flowName: flow?.name ?? draft.flowName }, "meta:flow")
                    }}
                  >
                    <option value="">{flows.length ? "Link a flow" : "No flows loaded"}</option>
                    {draft.flowId && !flows.some((flow) => flow.id === draft.flowId) ? <option value={draft.flowId}>{draft.flowName || draft.flowId}</option> : null}
                    {flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name} · {flow.status}</option>)}
                  </select>
                </label>
              </div>
              <div className="space-y-2 border-t border-[#ececee] pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717a]">Template</p>
                <Input value={templateName} placeholder="Template name" disabled={Boolean(proposalPreview)} onChange={(event) => setTemplateName(event.target.value)} />
                <Button size="sm" variant="outline" disabled={Boolean(proposalPreview)} onClick={() => void saveTemplate()}>Save template</Button>
                {draft.klaviyoTemplateId ? (
                  <p className="break-all text-xs text-[#71717a]">Klaviyo template {draft.klaviyoTemplateId}{klaviyoStale ? " · Local changes not pushed" : " · Up to date"}</p>
                ) : null}
              </div>
              <label className="block text-xs font-medium">
                Notes
                <textarea value={draft.notes} disabled={Boolean(proposalPreview)} className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm font-normal text-foreground" onChange={(event) => patch({ notes: event.target.value }, "meta:notes")} />
              </label>
              {!draft.flowId ? <Input value={draft.flowName} disabled={Boolean(proposalPreview)} placeholder="Flow name" onChange={(event) => patch({ flowName: event.target.value }, "meta:flow-name")} /> : null}
            </div>
          )}
          assistant={(
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
                setInspecting(false)
              }}
            />
          )}
          structure={(
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
                      onSelect={() => selectBlock(block.id)}
                      onRemove={() => removeBlock(block.id)}
                      onMove={(direction) => {
                        const target = index + direction
                        if (target < 0 || target >= draft.document.blocks.length) return
                        updateBlocks(arrayMove(draft.document.blocks, index, target))
                      }}
                    />
                    {block.type === "section" ? (
                      <div className="space-y-1 border-l border-[#e4e4e7] pl-3">
                        {block.columns.flatMap((column) => column.blocks).map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            className={cn(
                              "w-full rounded px-2 py-1 text-left text-xs",
                              child.id === selectedId ? "bg-[#7C5CFC]/10 text-[#18181b]" : "text-[#71717a] hover:bg-[#f4f4f5]",
                            )}
                            onClick={() => selectBlock(child.id)}
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
          )}
        />
      </div>
      <DragOverlay>
        {draggingLabel ? (
          <div className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#18181b] shadow-lg ring-1 ring-black/10">{draggingLabel}</div>
        ) : null}
      </DragOverlay>
      </DndContext>
      {mode === "preview" ? (
        <EmailStudioLivePreview
          projectId={draft.id}
          metricName={draft.triggerMetric}
          html={html}
          onClose={() => setMode("display")}
        />
      ) : null}
      <EmailStudioReviewPublish
        open={reviewOpen}
        projectName={displayDraft.name}
        subject={displayDraft.subject}
        previewText={displayDraft.previewText}
        document={displayDraft.document}
        html={html}
        connected={klaviyoConnected}
        onOpenChange={setReviewOpen}
        onPublish={reviewAndPublish}
      />
    </div>
  )
}
