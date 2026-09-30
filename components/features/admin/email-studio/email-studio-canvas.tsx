"use client"

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Columns3,
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
  ShoppingBag,
  Type,
} from "lucide-react"
import { EmailStudioBlockFrame, EmailStudioFormatBar } from "@/components/features/admin/email-studio/email-studio-selection"
import { EmailImageFrame } from "@/components/features/admin/email-studio/email-studio-image-frame"
import {
  KLAVIYO_EMAIL_BORDER,
  KLAVIYO_EMAIL_COLORS,
  KLAVIYO_EMAIL_FONT_HEADLINE,
  KLAVIYO_EMAIL_FONT_SANS,
  KLAVIYO_EMAIL_MUTED,
} from "@/lib/klaviyo/email-brand-styles"
import { cn } from "@/lib/utils"
import type { EmailBlock, EmailBlockType, EmailTextStyle } from "@/lib/types/emailStudio"
import { emailBlockLabel } from "@/components/features/admin/email-studio/email-studio-outline"

const FONT = KLAVIYO_EMAIL_FONT_SANS
const HEADLINE = KLAVIYO_EMAIL_FONT_HEADLINE
const TILE_LABEL: Partial<Record<EmailBlockType, string>> = {
  heading: "Title",
  text: "Paragraph",
  eyebrow: "Kicker",
  split: "Image & text",
  product: "Products",
}

export function emailStudioTileLabel(type: EmailBlockType): string {
  return TILE_LABEL[type] ?? emailBlockLabel(type)
}

const PALETTE_ICONS: Record<EmailBlockType, typeof Type> = {
  section: LayoutPanelTop,
  product: ShoppingBag,
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
      onPointerDown={(event) => event.stopPropagation()}
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

interface CanvasHandlers {
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onInsert: (afterId: string, type: EmailBlockType) => void
}

function hexIsDark(hex: string): boolean {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return false
  const value = Number.parseInt(hex.slice(1), 16)
  const red = (value >> 16) & 255
  const green = (value >> 8) & 255
  const blue = value & 255
  return (red * 299 + green * 587 + blue * 114) / 1000 < 150
}

function textPaint(block: EmailTextStyle): CSSProperties {
  const decoration = [block.underline ? "underline" : "", block.strike ? "line-through" : ""].filter(Boolean).join(" ")
  return {
    color: block.color,
    fontSize: block.fontSize,
    fontWeight: block.fontWeight === "bold" ? 700 : block.fontWeight === "normal" ? 400 : undefined,
    fontStyle: block.italic ? "italic" : undefined,
    textDecoration: decoration || undefined,
  }
}

function formatBar(block: EmailBlock, onChange: (block: EmailBlock) => void): ReactNode {
  if (block.type === "heading" || block.type === "text" || block.type === "eyebrow") {
    const bold = block.type === "text" ? block.fontWeight === "bold" : block.fontWeight !== "normal"
    return (
      <EmailStudioFormatBar
        bold={bold}
        italic={block.italic}
        underline={block.underline}
        strike={block.strike}
        align={block.align}
        onBold={() => onChange({ ...block, fontWeight: bold ? "normal" : "bold" })}
        onItalic={() => onChange({ ...block, italic: !block.italic })}
        onUnderline={() => onChange({ ...block, underline: !block.underline })}
        onStrike={() => onChange({ ...block, strike: !block.strike })}
        onAlign={(align) => onChange({ ...block, align })}
        onToken={(token) => onChange({ ...block, text: `${block.text}${block.text ? " " : ""}${token}` })}
      />
    )
  }
  if (block.type === "button") {
    const bold = block.fontWeight === "bold"
    return (
      <EmailStudioFormatBar
        bold={bold}
        align={block.align}
        onBold={() => onChange({ ...block, fontWeight: bold ? "normal" : "bold" })}
        onAlign={(align) => onChange({ ...block, align })}
      />
    )
  }
  return null
}

function CanvasBlock({
  block,
  handlers,
  onChange,
}: {
  block: EmailBlock
  handlers: CanvasHandlers
  onChange: (block: EmailBlock) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : undefined }}
      {...attributes}
      {...listeners}
    >
      <EmailStudioBlockFrame
        selected={block.id === handlers.selectedId}
        label={emailBlockLabel(block.type)}
        allowSection
        format={formatBar(block, onChange)}
        onSelect={() => handlers.onSelect(block.id)}
        onRemove={() => handlers.onRemove(block.id)}
        onDuplicate={() => handlers.onDuplicate(block.id)}
        onInsert={(type) => handlers.onInsert(block.id, type)}
      >
        <BlockBody block={block} handlers={handlers} onChange={onChange} />
      </EmailStudioBlockFrame>
    </div>
  )
}

function BlockBody({
  block,
  handlers,
  onChange,
  tone = "ink",
}: {
  block: EmailBlock
  handlers: CanvasHandlers
  onChange: (block: EmailBlock) => void
  tone?: "ink" | "light"
}) {
  const selected = block.id === handlers.selectedId
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
    const customDark = block.backgroundColor ? hexIsDark(block.backgroundColor) : null
    const childTone = customDark === null
      ? block.surface === "brand" || block.surface === "dark" ? "light" : "ink"
      : customDark ? "light" : "ink"
    const rowImage = block.backgroundImage && (block.backgroundImageOn ?? "row") === "row" ? block.backgroundImage : undefined
    const contentImage = block.backgroundImage && block.backgroundImageOn === "content" ? block.backgroundImage : undefined
    return (
      <div
        className={cn("rounded-lg", !block.backgroundColor && surface, padding, childTone === "light" && "text-white")}
        style={{
          backgroundColor: block.backgroundColor,
          backgroundImage: rowImage ? `url("${rowImage}")` : undefined,
          backgroundSize: block.backgroundFit === false ? "auto" : "cover",
          backgroundRepeat: block.backgroundRepeat ? "repeat" : "no-repeat",
          backgroundPosition: block.backgroundCenter === false ? "left top" : "center",
          borderWidth: block.borderWidth || undefined,
          borderStyle: block.borderWidth ? "solid" : undefined,
          borderColor: block.borderWidth ? block.borderColor ?? KLAVIYO_EMAIL_BORDER : undefined,
        }}
      >
        <div
          className={cn(block.stackOnMobile ? "flex flex-col sm:grid" : "grid", gap)}
          style={{
            gridTemplateColumns: block.columns.map((column) => `${column.width}fr`).join(" "),
            backgroundColor: block.contentBackgroundColor,
            backgroundImage: contentImage ? `url("${contentImage}")` : undefined,
            backgroundSize: block.backgroundFit === false ? "auto" : "cover",
            backgroundRepeat: block.backgroundRepeat ? "repeat" : "no-repeat",
            backgroundPosition: block.backgroundCenter === false ? "left top" : "center",
          }}
        >
          {block.columns.map((column) => (
            <div key={column.id} className="min-w-0 space-y-3">
              {column.blocks.map((child) => {
                const replaceChild = (replacement: EmailBlock) => {
                  if (replacement.type === "section" || replacement.type === "product") return
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
                }
                return (
                  <EmailStudioBlockFrame
                    key={child.id}
                    selected={child.id === handlers.selectedId}
                    label={emailBlockLabel(child.type)}
                    allowSection={false}
                    format={formatBar(child, replaceChild)}
                    onSelect={() => handlers.onSelect(child.id)}
                    onRemove={() => handlers.onRemove(child.id)}
                    onDuplicate={() => handlers.onDuplicate(child.id)}
                    onInsert={(type) => handlers.onInsert(child.id, type)}
                  >
                    <BlockBody
                      block={child}
                      tone={childTone}
                      handlers={handlers}
                      onChange={replaceChild}
                    />
                  </EmailStudioBlockFrame>
                )
              })}
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
          !block.color && (tone === "light" ? "text-white/70" : "text-[#64748B]"),
          block.align === "center" && "text-center",
        )}
        style={textPaint(block)}
      />
    )
  }
  if (block.type === "heading") {
    return (
      <InlineText
        label="Headline"
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        className={cn(!block.fontSize && "text-[26px]", block.fontWeight !== "normal" && "font-bold", block.align === "center" && "text-center")}
        style={{ fontFamily: HEADLINE, letterSpacing: "-0.05em", lineHeight: 1.05, ...textPaint(block) }}
      />
    )
  }
  if (block.type === "text") {
    return (
      <InlineText
        label="Text"
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        className={cn("whitespace-pre-wrap leading-relaxed", !block.fontSize && "text-base", block.align === "center" && "text-center")}
        style={textPaint(block)}
      />
    )
  }
  if (block.type === "button") {
    return (
      <div className={cn("py-1", block.align === "center" && "text-center", block.fullWidth && "w-full")}>
        <InlineText
          label="Button label"
          value={block.label}
          onChange={(label) => onChange({ ...block, label })}
          className={cn(
            "inline-block px-7 py-3.5 text-white",
            !block.fontSize && "text-base",
            block.fontWeight === "normal" ? "font-normal" : block.fontWeight === "bold" ? "font-bold" : "font-semibold",
            block.fullWidth && "block w-full text-center",
          )}
          style={{
            backgroundColor: block.backgroundColor ?? "#5574AD",
            color: block.textColor ?? "#ffffff",
            borderRadius: block.radius ?? 8,
            fontSize: block.fontSize,
            fontFamily: block.fontFamily === "headline" ? HEADLINE : undefined,
          }}
        />
      </div>
    )
  }
  if (block.type === "product") {
    return (
      <div>
        <InlineText
          label="Product block title"
          value={block.title}
          onChange={(title) => onChange({ ...block, title })}
          className="mb-4 text-2xl font-bold"
          style={{ fontFamily: HEADLINE, letterSpacing: "-0.04em" }}
        />
        {block.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#d4d4d8] px-4 py-10 text-center text-sm text-[#71717a]">
            Select Reswell listings in the sidebar
          </div>
        ) : (
          <div className={cn("grid gap-4", block.items.length > 1 && "sm:grid-cols-2")}>
            {block.items.map((item) => (
              <div key={item.id} className={cn("min-w-0", block.items.length === 1 && "sm:grid sm:grid-cols-2 sm:gap-5")}>
                {/* Listing photos are dynamic marketplace URLs and cannot use a fixed next/image host. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.title} className="aspect-[4/3] w-full rounded-lg object-cover" />
                <div className="pt-3">
                  {block.showAvailability ? (
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#64748B]">
                      {productAvailabilityLabel(item.availability)}
                    </p>
                  ) : null}
                  <p className="text-lg font-bold" style={{ fontFamily: HEADLINE, letterSpacing: "-0.04em" }}>{item.title}</p>
                  {block.showPrice && item.priceDisplay ? <p className="mt-1 font-bold">{item.priceDisplay}</p> : null}
                  <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
                    {[
                      block.showBoardType ? item.boardType : "",
                      block.showCondition ? item.condition : "",
                      block.showDimensions ? item.dimensions : "",
                    ].filter(Boolean).join(" · ")}
                  </p>
                  <span className="mt-3 inline-block rounded-lg bg-[#5574AD] px-4 py-2 text-sm font-semibold text-white">
                    {item.availability === "available" || item.availability === "pending" ? block.ctaLabel : "View listing"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
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
        radius={block.type === "image" ? block.radius : undefined}
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
    if (block.type === "image") {
      const pad = block.padding
      return (
        <div style={pad ? { padding: `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px` } : undefined}>
          {frame}
        </div>
      )
    }
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

function productAvailabilityLabel(value: "available" | "pending" | "sold" | "unavailable"): string {
  if (value === "available") return "Available"
  if (value === "pending") return "Pending sale"
  if (value === "sold") return "Sold"
  return "Unavailable"
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
  onInsert,
  onClear,
}: {
  blocks: EmailBlock[]
  selectedId: string | null
  width: number
  onSelect: (id: string) => void
  onChange: (block: EmailBlock) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onInsert: (afterId: string, type: EmailBlockType) => void
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
          className="space-y-6 px-6 pb-8 pt-16"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClear?.()
          }}
        >
          {blocks.map((block) => (
            <CanvasBlock
              key={block.id}
              block={block}
              handlers={{ selectedId, onSelect, onRemove, onDuplicate, onInsert }}
              onChange={onChange}
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
            isOver && "border-[#7C5CFC] bg-[#7C5CFC]/5",
          )}
        >
          {blocks.length === 0 ? "Drag a row or content block onto the stage" : null}
        </div>
      </div>
    </div>
  )
}
