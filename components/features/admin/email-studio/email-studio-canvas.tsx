"use client"

import { useEffect, useRef } from "react"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Copy, GripVertical, Trash2 } from "lucide-react"
import { EmailImageFrame } from "@/components/features/admin/email-studio/email-studio-image-frame"
import {
  KLAVIYO_EMAIL_BORDER,
  KLAVIYO_EMAIL_COLORS,
  KLAVIYO_EMAIL_FONT_SANS,
  KLAVIYO_EMAIL_MUTED,
  KLAVIYO_EMAIL_RADIUS,
} from "@/lib/klaviyo/email-brand-styles"
import { cn } from "@/lib/utils"
import type { EmailBlock, EmailBlockType } from "@/lib/types/emailStudio"
import { emailBlockLabel } from "@/components/features/admin/email-studio/email-studio-outline"

const FONT = KLAVIYO_EMAIL_FONT_SANS

function InlineText({
  value,
  onChange,
  className,
  label,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const editing = useRef(false)

  useEffect(() => {
    const node = ref.current
    if (!node || editing.current) return
    if (node.innerText !== value) node.innerText = value
  }, [value])

  return (
    <div
      ref={ref}
      role="textbox"
      aria-label={label}
      contentEditable
      suppressContentEditableWarning
      className={cn("outline-none", className)}
      onMouseDown={(event) => event.stopPropagation()}
      onFocus={() => {
        editing.current = true
      }}
      onBlur={(event) => {
        editing.current = false
        const next = event.currentTarget.innerText.replace(/\u00a0/g, " ")
        if (next !== value) onChange(next)
      }}
    />
  )
}

function CanvasBlock({
  block,
  selected,
  onSelect,
  onChange,
  onRemove,
  onDuplicate,
}: {
  block: EmailBlock
  selected: boolean
  onSelect: () => void
  onChange: (block: EmailBlock) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : undefined }}
      className={cn("group relative rounded-md", selected && "ring-2 ring-[#5574AD]")}
      onClick={onSelect}
    >
      <div className="absolute -left-9 top-0 flex flex-col gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
        <button
          type="button"
          className="rounded border border-border bg-white p-1 text-muted-foreground shadow-sm"
          aria-label={`Drag ${emailBlockLabel(block.type)}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="rounded border border-border bg-white p-1 text-muted-foreground shadow-sm" aria-label="Duplicate block" onClick={onDuplicate}>
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="rounded border border-border bg-white p-1 text-muted-foreground shadow-sm hover:text-destructive" aria-label="Remove block" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <BlockBody block={block} selected={selected} onChange={onChange} />
    </div>
  )
}

function BlockBody({
  block,
  selected,
  onChange,
}: {
  block: EmailBlock
  selected: boolean
  onChange: (block: EmailBlock) => void
}) {
  if (block.type === "logo") {
    return (
      <div className="flex justify-center py-2">
        {block.src ? (
          // Email preview uses the stored URL; next/image cannot accept arbitrary Klaviyo or upload hosts.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={block.src} alt={block.alt || "Logo"} style={{ width: block.width }} className="h-auto max-w-full" />
        ) : (
          <span className="text-xs text-muted-foreground">Logo</span>
        )}
      </div>
    )
  }
  if (block.type === "eyebrow") {
    return (
      <InlineText
        label="Eyebrow"
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        className={cn("text-xs font-bold uppercase tracking-[0.1em] text-[#64748B]", block.align === "center" && "text-center")}
      />
    )
  }
  if (block.type === "heading") {
    return (
      <InlineText
        label="Headline"
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        className={cn("text-[26px] font-bold leading-tight tracking-tight", block.align === "center" && "text-center")}
      />
    )
  }
  if (block.type === "text") {
    return (
      <InlineText
        label="Text"
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        className={cn("whitespace-pre-wrap text-base leading-relaxed", block.align === "center" && "text-center")}
      />
    )
  }
  if (block.type === "button") {
    return (
      <div className={cn("py-1", block.align === "center" && "text-center")}>
        <InlineText
          label="Button label"
          value={block.label}
          onChange={(label) => onChange({ ...block, label })}
          className="inline-block rounded-lg bg-[#5574AD] px-7 py-3.5 text-base font-semibold text-white"
        />
      </div>
    )
  }
  if (block.type === "image" || block.type === "split") {
    const frame = (
      <EmailImageFrame
        src={block.type === "image" ? block.src : block.imageSrc}
        alt={block.type === "image" ? block.alt : block.imageAlt}
        width={block.type === "image" ? block.width ?? 560 : block.imageWidth ?? 240}
        height={block.type === "image" ? block.height ?? null : block.imageHeight ?? null}
        maxWidth={block.type === "image" ? 560 : 280}
        selected={selected}
        onChange={(patch) => {
          if (block.type === "image") {
            onChange({
              ...block,
              src: patch.src ?? block.src,
              alt: patch.alt ?? block.alt,
              width: patch.width ?? block.width,
              height: patch.height === undefined ? block.height : patch.height,
            })
          } else {
            onChange({
              ...block,
              imageSrc: patch.src ?? block.imageSrc,
              imageAlt: patch.alt ?? block.imageAlt,
              imageWidth: patch.width ?? block.imageWidth,
              imageHeight: patch.height === undefined ? block.imageHeight : patch.height,
            })
          }
        }}
      />
    )
    if (block.type === "image") return frame
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {frame}
        <div className="space-y-2">
          <InlineText label="Title" value={block.title} onChange={(title) => onChange({ ...block, title })} className="text-lg font-bold" />
          <InlineText label="Text" value={block.text} onChange={(text) => onChange({ ...block, text })} className="whitespace-pre-wrap text-[15px] leading-relaxed" />
          <InlineText label="Button" value={block.buttonLabel} onChange={(buttonLabel) => onChange({ ...block, buttonLabel })} className="inline-block rounded-lg bg-[#5574AD] px-4 py-2 text-sm font-semibold text-white" />
        </div>
      </div>
    )
  }
  if (block.type === "details") {
    return (
      <div className="rounded-lg border p-4" style={{ borderColor: KLAVIYO_EMAIL_BORDER }}>
        <InlineText label="Card title" value={block.title} onChange={(title) => onChange({ ...block, title })} className="mb-2 text-xs font-bold uppercase tracking-wide text-[#163060]" />
        {block.rows.map((row) => (
          <div key={row.id} className="grid grid-cols-2 gap-2 border-t py-2 text-sm" style={{ borderColor: KLAVIYO_EMAIL_BORDER }}>
            <InlineText label="Label" value={row.label} onChange={(label) => onChange({ ...block, rows: block.rows.map((item) => item.id === row.id ? { ...item, label } : item) })} className="text-[#64748B]" />
            <InlineText label="Value" value={row.value} onChange={(value) => onChange({ ...block, rows: block.rows.map((item) => item.id === row.id ? { ...item, value } : item) })} className="text-right font-bold" />
          </div>
        ))}
      </div>
    )
  }
  if (block.type === "divider") {
    return <div className="border-t" style={{ borderColor: KLAVIYO_EMAIL_BORDER }} />
  }
  if (block.type === "spacer") {
    return <div style={{ height: block.height }} />
  }
  return (
    <div className="text-center text-[13px] leading-relaxed" style={{ color: KLAVIYO_EMAIL_MUTED }}>
      <InlineText label="Footer" value={block.text} onChange={(text) => onChange({ ...block, text })} />
      {block.showUnsubscribe ? <p className="mt-2">Unsubscribe</p> : null}
    </div>
  )
}

export function EmailStudioPaletteChip({ type }: { type: EmailBlockType }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}` })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "cursor-grab rounded-md border border-border bg-background px-2 py-1.5 text-left text-xs hover:bg-muted active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
      {...attributes}
      {...listeners}
    >
      {emailBlockLabel(type)}
    </button>
  )
}

export function EmailStudioCanvas({
  blocks,
  selectedId,
  width,
  onSelect,
  onChange,
  onRemove,
  onDuplicate,
}: {
  blocks: EmailBlock[]
  selectedId: string | null
  width: number
  onSelect: (id: string) => void
  onChange: (block: EmailBlock) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-end" })

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <div
        className="mx-auto bg-white px-6 py-8 shadow-sm"
        style={{
          width,
          maxWidth: "100%",
          fontFamily: FONT,
          color: KLAVIYO_EMAIL_COLORS.foreground,
          borderRadius: KLAVIYO_EMAIL_RADIUS,
        }}
      >
        <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {blocks.map((block) => (
            <CanvasBlock
              key={block.id}
              block={block}
              selected={block.id === selectedId}
              onSelect={() => onSelect(block.id)}
              onChange={onChange}
              onRemove={() => onRemove(block.id)}
              onDuplicate={() => onDuplicate(block.id)}
            />
          ))}
        </div>
        </SortableContext>
        <div
          ref={setNodeRef}
          className={cn(
            "mt-4 rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground",
            isOver && "border-[#5574AD] bg-[#5574AD]/5",
          )}
        >
          Drop a block here
        </div>
      </div>
    </div>
  )
}
