"use client"

import { useState, type ReactNode } from "react"
import {
  AlignCenter,
  AlignLeft,
  Bold,
  Copy,
  Italic,
  Plus,
  Strikethrough,
  Trash2,
  Underline,
} from "lucide-react"
import { EMAIL_MERGE_TOKENS } from "@/lib/email-studio/tokens"
import type { EmailAlign, EmailBlockType } from "@/lib/types/emailStudio"
import { cn } from "@/lib/utils"

const ADD_ITEMS: { type: EmailBlockType; label: string }[] = [
  { type: "heading", label: "Title" },
  { type: "text", label: "Paragraph" },
  { type: "image", label: "Image" },
  { type: "button", label: "Button" },
  { type: "divider", label: "Divider" },
  { type: "section", label: "Row" },
]

export function EmailStudioBlockFrame({
  selected,
  label,
  allowSection,
  format,
  onSelect,
  onRemove,
  onDuplicate,
  onInsert,
  children,
}: {
  selected: boolean
  label: string
  allowSection: boolean
  format?: ReactNode
  onSelect: () => void
  onRemove: () => void
  onDuplicate: () => void
  onInsert: (type: EmailBlockType) => void
  children: ReactNode
}) {
  const [adding, setAdding] = useState(false)
  const items = ADD_ITEMS.filter((item) => allowSection || item.type !== "section")

  return (
    <div className={cn(selected && "pt-16")}>
    <div
      className={cn(
        "relative",
        selected
          ? "outline outline-2 outline-[#7C5CFC] outline-offset-2"
          : "hover:outline hover:outline-1 hover:outline-[#7C5CFC]/70 hover:outline-offset-2",
      )}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
    >
      {selected ? (
        <>
          {format ? (
            <div
              className="absolute -top-10 left-0 z-30"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              {format}
            </div>
          ) : null}
          <div
            className="absolute -top-10 right-0 z-30 flex gap-1"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <FrameIconButton label={`Duplicate ${label}`} onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5" />
            </FrameIconButton>
            <FrameIconButton label={`Remove ${label}`} onClick={onRemove}>
              <Trash2 className="h-3.5 w-3.5" />
            </FrameIconButton>
          </div>
          <div
            className="absolute -right-3 top-1/2 z-30 -translate-y-1/2"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label={`Add a block after ${label}`}
              aria-expanded={adding}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7C5CFC] text-white shadow-md hover:bg-[#6b4cf0]"
              onClick={() => setAdding((open) => !open)}
            >
              <Plus className="h-4 w-4" />
            </button>
            {adding ? (
              <div className="absolute right-0 top-8 w-36 overflow-hidden rounded-md border border-[#e4e4e7] bg-white py-1 text-[#18181b] shadow-lg">
                {items.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[#f4f4f5]"
                    onClick={() => {
                      setAdding(false)
                      onInsert(item.type)
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
      {children}
    </div>
    </div>
  )
}

function FrameIconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md bg-[#7C5CFC] text-white shadow-md hover:bg-[#6b4cf0]"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function EmailStudioFormatBar({
  bold,
  italic,
  underline,
  strike,
  align,
  onBold,
  onItalic,
  onUnderline,
  onStrike,
  onAlign,
  onToken,
}: {
  bold: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  align: EmailAlign
  onBold?: () => void
  onItalic?: () => void
  onUnderline?: () => void
  onStrike?: () => void
  onAlign: (align: EmailAlign) => void
  onToken?: (token: string) => void
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-[#1c1c1c] px-1 py-1 text-white shadow-lg">
      {onBold ? <FormatButton label="Bold" active={bold} onClick={onBold}><Bold className="h-3.5 w-3.5" /></FormatButton> : null}
      {onItalic ? <FormatButton label="Italic" active={Boolean(italic)} onClick={onItalic}><Italic className="h-3.5 w-3.5" /></FormatButton> : null}
      {onUnderline ? <FormatButton label="Underline" active={Boolean(underline)} onClick={onUnderline}><Underline className="h-3.5 w-3.5" /></FormatButton> : null}
      {onStrike ? <FormatButton label="Strikethrough" active={Boolean(strike)} onClick={onStrike}><Strikethrough className="h-3.5 w-3.5" /></FormatButton> : null}
      <FormatButton label="Align left" active={align === "left"} onClick={() => onAlign("left")}>
        <AlignLeft className="h-3.5 w-3.5" />
      </FormatButton>
      <FormatButton label="Align center" active={align === "center"} onClick={() => onAlign("center")}>
        <AlignCenter className="h-3.5 w-3.5" />
      </FormatButton>
      {onToken ? (
        <select
          aria-label="Merge tags"
          className="h-7 max-w-[7.5rem] rounded bg-transparent px-1 text-[11px] text-white outline-none"
          value=""
          onChange={(event) => {
            if (event.target.value) onToken(event.target.value)
          }}
        >
          <option value="" className="text-[#18181b]">Merge tags</option>
          {EMAIL_MERGE_TOKENS.map((token) => (
            <option key={token.value} value={token.value} className="text-[#18181b]">
              {token.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  )
}

function FormatButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={cn("flex h-7 w-7 items-center justify-center rounded", active ? "bg-white/20" : "hover:bg-white/10")}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
