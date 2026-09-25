"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EmailBlock, EmailBlockType } from "@/lib/types/emailStudio"

const LABELS: Record<EmailBlockType, string> = {
  logo: "Logo",
  eyebrow: "Eyebrow",
  heading: "Headline",
  text: "Text",
  image: "Image",
  button: "Button",
  split: "Image + text",
  details: "Details",
  divider: "Divider",
  spacer: "Spacer",
  footer: "Footer",
}

export function emailBlockLabel(type: EmailBlockType): string {
  return LABELS[type]
}

export function emailBlockSummary(block: EmailBlock): string {
  if (block.type === "heading" || block.type === "eyebrow" || block.type === "text") {
    return block.text.replace(/\s+/g, " ").trim().slice(0, 42)
  }
  if (block.type === "button") return block.label
  if (block.type === "details") return block.title
  if (block.type === "split") return block.title
  if (block.type === "footer") return block.showUnsubscribe ? "Unsubscribe on" : "Unsubscribe off"
  return ""
}

export function EmailStudioOutlineRow({
  block,
  active,
  onSelect,
  onRemove,
  onMove,
}: {
  block: EmailBlock
  active: boolean
  onSelect: () => void
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  })
  const summary = emailBlockSummary(block)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : undefined }}
      className={cn(
        "flex items-center gap-1 rounded-md border px-1 py-1",
        active ? "border-[#5574AD] bg-[#5574AD]/5" : "border-border bg-background",
      )}
    >
      <button
        type="button"
        className="touch-none px-1 text-muted-foreground hover:text-foreground"
        aria-label={`Drag ${emailBlockLabel(block.type)}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" className="min-w-0 flex-1 py-1 text-left" onClick={onSelect}>
        <span className="block text-sm font-medium">{emailBlockLabel(block.type)}</span>
        {summary ? <span className="block truncate text-xs text-muted-foreground">{summary}</span> : null}
      </button>
      <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Move up" onClick={() => onMove(-1)}>
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Move down" onClick={() => onMove(1)}>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Remove block" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
