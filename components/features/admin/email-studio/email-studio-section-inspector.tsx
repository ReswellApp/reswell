"use client"

import { Trash2 } from "lucide-react"
import { createEmailBlock, emailBlockId } from "@/lib/email-studio/document"
import type {
  EmailBlockType,
  EmailContentBlock,
  EmailSectionBlock,
} from "@/lib/types/emailStudio"
import { emailBlockLabel } from "@/components/features/admin/email-studio/email-studio-outline"
import { EmailStudioRowProperties } from "@/components/features/admin/email-studio/email-studio-row-properties"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const CONTENT_TYPES: EmailBlockType[] = [
  "eyebrow",
  "heading",
  "text",
  "image",
  "button",
  "split",
  "details",
  "divider",
  "spacer",
]

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm"

export function EmailStudioSectionInspector({
  section,
  onChange,
}: {
  section: EmailSectionBlock
  onChange: (section: EmailSectionBlock) => void
}) {
  function setColumnCount(count: number): void {
    if (count === section.columns.length) return
    if (count > section.columns.length) {
      onChange({
        ...section,
        columns: [
          ...section.columns,
          ...Array.from({ length: count - section.columns.length }, () => ({
            id: emailBlockId(),
            width: 1 as const,
            blocks: [] as EmailContentBlock[],
          })),
        ],
      })
      return
    }
    const kept = section.columns.slice(0, count)
    const overflow = section.columns.slice(count).flatMap((column) => column.blocks)
    const last = kept.at(-1)
    if (last) {
      kept[kept.length - 1] = { ...last, blocks: [...last.blocks, ...overflow] }
    }
    onChange({ ...section, columns: kept })
  }

  function addBlock(columnId: string, type: EmailBlockType): void {
    const block = createEmailBlock(type)
    if (block.type === "section") return
    onChange({
      ...section,
      columns: section.columns.map((column) => (
        column.id === columnId
          ? { ...column, blocks: [...column.blocks, block] }
          : column
      )),
    })
  }

  return (
    <div>
      <EmailStudioRowProperties section={section} onChange={onChange} />
      <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <Label>Surface</Label>
          <select className={selectClass} value={section.surface} onChange={(event) => onChange({ ...section, surface: event.target.value as EmailSectionBlock["surface"] })}>
            <option value="white">White</option>
            <option value="muted">Sand</option>
            <option value="brand">Brand blue</option>
            <option value="dark">Ink</option>
          </select>
        </label>
        <label className="space-y-1">
          <Label>Padding</Label>
          <select className={selectClass} value={section.padding} onChange={(event) => onChange({ ...section, padding: event.target.value as EmailSectionBlock["padding"] })}>
            <option value="none">None</option>
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="spacious">Spacious</option>
          </select>
        </label>
        <label className="space-y-1">
          <Label>Gap</Label>
          <select className={selectClass} value={section.gap} onChange={(event) => onChange({ ...section, gap: event.target.value as EmailSectionBlock["gap"] })}>
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="spacious">Spacious</option>
          </select>
        </label>
        <label className="space-y-1">
          <Label>Columns</Label>
          <select className={selectClass} value={section.columns.length} onChange={(event) => setColumnCount(Number(event.target.value))}>
            <option value={1}>One</option>
            <option value={2}>Two</option>
            <option value={3}>Three</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={section.stackOnMobile} onChange={(event) => onChange({ ...section, stackOnMobile: event.target.checked })} />
        Stack columns on phones
      </label>
      {section.columns.map((column, index) => (
        <div key={column.id} className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Column {index + 1}</p>
            <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={column.width} onChange={(event) => onChange({
              ...section,
              columns: section.columns.map((item) => item.id === column.id ? { ...item, width: Number(event.target.value) as 1 | 2 | 3 } : item),
            })}>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={3}>3×</option>
            </select>
          </div>
          {column.blocks.map((block) => (
            <div key={block.id} className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate">{emailBlockLabel(block.type)}</span>
              <Button size="icon" variant="ghost" aria-label={`Remove ${emailBlockLabel(block.type)}`} onClick={() => onChange({
                ...section,
                columns: section.columns.map((item) => item.id === column.id ? { ...item, blocks: item.blocks.filter((child) => child.id !== block.id) } : item),
              })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <select className={selectClass} value="" onChange={(event) => {
            if (event.target.value) addBlock(column.id, event.target.value as EmailBlockType)
          }}>
            <option value="">Add a layer…</option>
            {CONTENT_TYPES.map((type) => <option key={type} value={type}>{emailBlockLabel(type)}</option>)}
          </select>
        </div>
      ))}
      </div>
    </div>
  )
}
