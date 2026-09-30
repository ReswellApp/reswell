"use client"

import { useEffect, useRef, type CSSProperties } from "react"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Columns3,
  Copy,
  GripVertical,
  Heading1,
  ImageIcon,
  LayoutPanelTop,
  List,
  Minus,
  MousePointerClick,
  MoveVertical,
  PanelBottom,
  Pilcrow,
  RectangleHorizontal,
  Trash2,
  Type,
} from "lucide-react"
import { EmailImageFrame } from "@/components/features/admin/email-studio/email-studio-image-frame"
import {
  KLAVIYO_EMAIL_BORDER,
  KLAVIYO_EMAIL_COLORS,
  KLAVIYO_EMAIL_FONT_HEADLINE,
  KLAVIYO_EMAIL_FONT_SANS,
  KLAVIYO_EMAIL_MUTED,
} from "@/lib/klaviyo/email-brand-styles"
import { cn } from "@/lib/utils"
import type { EmailBlock, EmailBlockType } from "@/lib/types/emailStudio"
import { emailBlockLabel } from "@/components/features/admin/email-studio/email-studio-outline"

const FONT = KLAVIYO_EMAIL_FONT_SANS
const HEADLINE = KLAVIYO_EMAIL_FONT_HEADLINE
const TILE_LABEL: Partial<Record<EmailBlockType, string>> = {
  heading: "Title",
  text: "Paragraph",
  eyebrow: "Kicker",
  split: "Image & text",
}

export function emailStudioTileLabel(type: EmailBlockType): string {
  return TILE_LABEL[type] ?? emailBlockLabel(type)
}

const PALETTE_ICONS: Record<EmailBlockType, typeof Type> = {
  section: LayoutPanelTop,
  logo: RectangleHorizontal,
  eyebrow: Type,
  heading: Heading1,
  text: Pilcrow,
  image: ImageIcon,
  button: MousePointerClick,
  split: Columns3,
  details: List,
  divider: Minus,
  spacer: MoveVertical,
  footer: PanelBottom,
}

function InlineText({
  value,
  onChange,
  className,
  label,
  style,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
  label: string
  style?: CSSProperties
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
      style={style}
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
  selectedId,
  onSelect,
  onChange,
  onRemove,
  onDuplicate,
}: {
  block: EmailBlock
  selectedId: string | null
  onSelect: (id: string) => void
  onChange: (block: EmailBlock) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const selected = block.id === selectedId

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : undefined }}
      className={cn(
        "relative rounded-sm",
        selected
          ? "outline outline-2 -outline-offset-2 outline-[#2F6FED]"
          : "hover:outline hover:outline-1 hover:-outline-offset-2 hover:outline-[#2F6FED]/70",
      )}
      onClick={() => onSelect(block.id)}
    >
      {selected && !isDragging ? (
        <div className="absolute -top-3 left-2 z-20 flex items-center overflow-hidden rounded-md bg-white shadow-[0_6px_18px_rgba(15,23,42,0.14)] ring-1 ring-black/10">
          <span className="bg-[#2F6FED] px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            {emailBlockLabel(block.type)}
          </span>
          <button
            type="button"
            className="p-1.5 text-[#3f3f46] hover:bg-[#f4f4f5]"
            aria-label={`Drag ${emailBlockLabel(block.type)}`}
            onClick={(event) => event.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="p-1.5 text-[#3f3f46] hover:bg-[#f4f4f5]"
            aria-label="Duplicate block"
            onClick={(event) => {
              event.stopPropagation()
              onDuplicate()
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="p-1.5 text-[#3f3f46] hover:bg-red-50 hover:text-red-600"
            aria-label="Remove block"
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <BlockBody
        block={block}
        selectedId={selectedId}
        onSelect={onSelect}
        onChange={onChange}
      />
    </div>
  )
}

function BlockBody({
  block,
  selectedId,
  onSelect,
  onChange,
  tone = "ink",
}: {
  block: EmailBlock
  selectedId: string | null
  onSelect: (id: string) => void
  onChange: (block: EmailBlock) => void
  tone?: "ink" | "light"
}) {
  const selected = block.id === selectedId
  if (block.type === "section") {
    const surface = block.surface === "white"
      ? "bg-white"
      : block.surface === "muted"
        ? "bg-[#F9F9F2]"
        : block.surface === "brand"
          ? "bg-[#5574AD] text-white"
          : "bg-[#0F172A] text-white"
    const padding = block.padding === "none"
      ? "p-0"
      : block.padding === "compact"
        ? "p-4"
        : block.padding === "spacious"
          ? "p-8"
          : "p-6"
    const gap = block.gap === "compact" ? "gap-3" : block.gap === "spacious" ? "gap-8" : "gap-5"
    const childTone = block.surface === "brand" || block.surface === "dark" ? "light" : "ink"
    return (
      <div className={cn("rounded-lg", surface, padding)}>
        <div
          className={cn(block.stackOnMobile ? "flex flex-col sm:grid" : "grid", gap)}
          style={{ gridTemplateColumns: block.columns.map((column) => `${column.width}fr`).join(" ") }}
        >
          {block.columns.map((column) => (
            <div key={column.id} className="min-w-0 space-y-3">
              {column.blocks.map((child) => (
                <div
                  key={child.id}
                  className={cn(
                    "rounded-sm",
                    child.id === selectedId && "outline outline-2 -outline-offset-2 outline-[#2F6FED]",
                  )}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelect(child.id)
                  }}
                >
                  <BlockBody
                    block={child}
                    tone={childTone}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onChange={(replacement) => {
                      if (replacement.type === "section") return
                      onChange({
                        ...block,
                        columns: block.columns.map((item) => (
                          item.id === column.id
                            ? {
                                ...item,
                                blocks: item.blocks.map((current) => (
                                  current.id === replacement.id ? replacement : current
                                )),
                              }
                            : item
                        )),
                      })
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }
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
        className={cn(
          "text-xs font-bold uppercase tracking-[0.1em]",
          tone === "light" ? "text-white/70" : "text-[#64748B]",
          block.align === "center" && "text-center",
        )}
      />
    )
  }
  if (block.type === "heading") {
    return (
      <InlineText
        label="Headline"
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        className={cn("text-[26px] font-bold", block.align === "center" && "text-center")}
        style={{ fontFamily: HEADLINE, letterSpacing: "-0.05em", lineHeight: 1.05 }}
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
          <InlineText label="Title" value={block.title} onChange={(title) => onChange({ ...block, title })} className="text-lg font-bold" style={{ fontFamily: HEADLINE, letterSpacing: "-0.05em", lineHeight: 1.05 }} />
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

export function EmailStudioPaletteChip({
  type,
  onActivate,
}: {
  type: EmailBlockType
  onActivate?: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}` })
  const Icon = PALETTE_ICONS[type]
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "flex h-[78px] w-full cursor-grab flex-col items-center justify-center gap-2 rounded-lg bg-[#f3f3f4] px-1 text-[11px] font-medium leading-tight text-[#3f3f46] transition hover:bg-[#e7e7ea] active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
      onClick={onActivate}
    >
      <Icon className="h-5 w-5 text-[#52525b]" strokeWidth={1.75} />
      {emailStudioTileLabel(type)}
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
  onClear,
}: {
  blocks: EmailBlock[]
  selectedId: string | null
  width: number
  onSelect: (id: string) => void
  onChange: (block: EmailBlock) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onClear?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-end" })

  return (
    <div
      className="min-h-0 flex-1 overflow-auto bg-[#e6e6e6] px-8 py-14 sm:px-14"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClear?.()
      }}
    >
      <div
        className="mx-auto bg-white shadow-[0_18px_50px_rgba(15,23,42,0.14)]"
        style={{
          width,
          maxWidth: "100%",
          fontFamily: FONT,
          color: KLAVIYO_EMAIL_COLORS.foreground,
        }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClear?.()
        }}
      >
        <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
        <div
          className="space-y-6 px-6 py-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClear?.()
          }}
        >
          {blocks.map((block) => (
            <CanvasBlock
              key={block.id}
              block={block}
              selectedId={selectedId}
              onSelect={onSelect}
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
            blocks.length === 0
              ? "mx-6 mb-8 rounded-md border border-dashed border-[#d4d4d8] px-3 py-16 text-center text-sm text-[#71717a]"
              : "mx-6 mb-6 h-8 rounded-md border border-dashed border-transparent",
            isOver && "border-[#2F6FED] bg-[#2F6FED]/5",
          )}
        >
          {blocks.length === 0 ? "Drag a row or content block onto the stage" : null}
        </div>
      </div>
    </div>
  )
}
