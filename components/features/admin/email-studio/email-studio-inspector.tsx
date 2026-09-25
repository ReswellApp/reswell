"use client"

import { useState } from "react"
import { uploadBlogMediaFile } from "@/lib/blog/upload-blog-media"
import { EMAIL_MERGE_TOKENS } from "@/lib/email-studio/tokens"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { EmailBlock, EmailDetailRow } from "@/lib/types/emailStudio"
import { emailBlockLabel } from "@/components/features/admin/email-studio/email-studio-outline"

const fieldClass = "space-y-1.5"

function TokenSelect({ onPick }: { onPick: (token: string) => void }) {
  return (
    <select
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
      value=""
      onChange={(event) => {
        if (event.target.value) onPick(event.target.value)
      }}
    >
      <option value="">Insert Klaviyo tag</option>
      {EMAIL_MERGE_TOKENS.map((token) => (
        <option key={token.value} value={token.value}>
          {token.group}: {token.label}
        </option>
      ))}
    </select>
  )
}

function AlignField({
  value,
  onChange,
}: {
  value: "left" | "center"
  onChange: (value: "left" | "center") => void
}) {
  return (
    <div className={fieldClass}>
      <Label>Align</Label>
      <select
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value === "center" ? "center" : "left")}
      >
        <option value="left">Left</option>
        <option value="center">Center</option>
      </select>
    </div>
  )
}

export function EmailStudioInspector({
  block,
  onChange,
}: {
  block: EmailBlock | null
  onChange: (block: EmailBlock) => void
}) {
  const [uploading, setUploading] = useState(false)

  if (!block) {
    return <p className="text-sm text-muted-foreground">Select a block to edit it.</p>
  }

  async function upload(file: File, apply: (url: string) => void) {
    setUploading(true)
    const uploaded = await uploadBlogMediaFile(file)
    setUploading(false)
    if (uploaded?.url) apply(uploaded.url)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{emailBlockLabel(block.type)}</p>
      {block.type === "logo" ? (
        <>
          <div className={fieldClass}>
            <Label>Image URL</Label>
            <Input value={block.src} onChange={(event) => onChange({ ...block, src: event.target.value })} />
          </div>
          <div className={fieldClass}>
            <Label>Link</Label>
            <Input value={block.href} onChange={(event) => onChange({ ...block, href: event.target.value })} />
          </div>
          <div className={fieldClass}>
            <Label>Alt</Label>
            <Input value={block.alt} onChange={(event) => onChange({ ...block, alt: event.target.value })} />
          </div>
          <div className={fieldClass}>
            <Label>Width</Label>
            <Input
              type="number"
              min={80}
              max={220}
              value={block.width}
              onChange={(event) => onChange({ ...block, width: Number(event.target.value) || 140 })}
            />
          </div>
        </>
      ) : null}
      {block.type === "eyebrow" || block.type === "heading" || block.type === "text" ? (
        <>
          <div className={fieldClass}>
            <Label>Copy</Label>
            <Textarea
              value={block.text}
              rows={block.type === "text" ? 8 : 3}
              onChange={(event) => onChange({ ...block, text: event.target.value })}
            />
          </div>
          <TokenSelect onPick={(token) => onChange({ ...block, text: `${block.text}${block.text ? " " : ""}${token}` })} />
          <AlignField value={block.align} onChange={(align) => onChange({ ...block, align })} />
        </>
      ) : null}
      {block.type === "image" ? (
        <>
          <ImageFields
            src={block.src}
            alt={block.alt}
            href={block.href}
            uploading={uploading}
            onChange={(patch) => onChange({ ...block, ...patch })}
            onFile={(file) => void upload(file, (src) => onChange({ ...block, src }))}
          />
        </>
      ) : null}
      {block.type === "button" ? (
        <>
          <div className={fieldClass}>
            <Label>Label</Label>
            <Input value={block.label} onChange={(event) => onChange({ ...block, label: event.target.value })} />
          </div>
          <div className={fieldClass}>
            <Label>Link</Label>
            <Input value={block.href} onChange={(event) => onChange({ ...block, href: event.target.value })} />
          </div>
          <TokenSelect onPick={(token) => onChange({ ...block, href: token })} />
          <AlignField value={block.align} onChange={(align) => onChange({ ...block, align })} />
        </>
      ) : null}
      {block.type === "split" ? (
        <>
          <ImageFields
            src={block.imageSrc}
            alt={block.imageAlt}
            href={block.imageHref}
            uploading={uploading}
            onChange={(patch) =>
              onChange({
                ...block,
                imageSrc: patch.src ?? block.imageSrc,
                imageAlt: patch.alt ?? block.imageAlt,
                imageHref: patch.href ?? block.imageHref,
              })
            }
            onFile={(file) => void upload(file, (imageSrc) => onChange({ ...block, imageSrc }))}
          />
          <div className={fieldClass}>
            <Label>Title</Label>
            <Input value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} />
          </div>
          <div className={fieldClass}>
            <Label>Text</Label>
            <Textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} />
          </div>
          <div className={fieldClass}>
            <Label>Button</Label>
            <Input value={block.buttonLabel} onChange={(event) => onChange({ ...block, buttonLabel: event.target.value })} />
          </div>
          <div className={fieldClass}>
            <Label>Button link</Label>
            <Input value={block.buttonHref} onChange={(event) => onChange({ ...block, buttonHref: event.target.value })} />
          </div>
        </>
      ) : null}
      {block.type === "details" ? (
        <DetailsFields block={block} onChange={onChange} />
      ) : null}
      {block.type === "spacer" ? (
        <div className={fieldClass}>
          <Label>Height</Label>
          <Input
            type="number"
            min={8}
            max={80}
            value={block.height}
            onChange={(event) => onChange({ ...block, height: Number(event.target.value) || 24 })}
          />
        </div>
      ) : null}
      {block.type === "footer" ? (
        <>
          <div className={fieldClass}>
            <Label>Footer copy</Label>
            <Textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.showUnsubscribe}
              onChange={(event) => onChange({ ...block, showUnsubscribe: event.target.checked })}
            />
            Unsubscribe link
          </label>
        </>
      ) : null}
      {block.type === "divider" ? (
        <p className="text-sm text-muted-foreground">A hairline between sections.</p>
      ) : null}
    </div>
  )
}

function ImageFields({
  src,
  alt,
  href,
  uploading,
  onChange,
  onFile,
}: {
  src: string
  alt: string
  href: string
  uploading: boolean
  onChange: (patch: { src?: string; alt?: string; href?: string }) => void
  onFile: (file: File) => void
}) {
  return (
    <>
      <div className={fieldClass}>
        <Label>Image</Label>
        <Input value={src} placeholder="https:// or drop a file" onChange={(event) => onChange({ src: event.target.value })} />
      </div>
      <label
        className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground hover:bg-muted/50"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files[0]
          if (file) onFile(file)
        }}
      >
        {uploading ? "Uploading…" : "Drop an image you own, or browse"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onFile(file)
          }}
        />
      </label>
      <div className={fieldClass}>
        <Label>Alt</Label>
        <Input value={alt} onChange={(event) => onChange({ alt: event.target.value })} />
      </div>
      <div className={fieldClass}>
        <Label>Link</Label>
        <Input value={href} onChange={(event) => onChange({ href: event.target.value })} />
      </div>
      <TokenSelect onPick={(token) => onChange({ href: token })} />
    </>
  )
}

function DetailsFields({
  block,
  onChange,
}: {
  block: Extract<EmailBlock, { type: "details" }>
  onChange: (block: EmailBlock) => void
}) {
  function updateRow(rowId: string, patch: Partial<EmailDetailRow>) {
    onChange({
      ...block,
      rows: block.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    })
  }

  return (
    <>
      <div className={fieldClass}>
        <Label>Card title</Label>
        <Input value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} />
      </div>
      {block.rows.map((row) => (
        <div key={row.id} className="grid grid-cols-2 gap-2">
          <Input value={row.label} aria-label="Row label" onChange={(event) => updateRow(row.id, { label: event.target.value })} />
          <Input value={row.value} aria-label="Row value" onChange={(event) => updateRow(row.id, { value: event.target.value })} />
        </div>
      ))}
      <TokenSelect
        onPick={(token) => {
          const last = block.rows[block.rows.length - 1]
          if (!last) return
          updateRow(last.id, { value: `${last.value}${last.value ? " " : ""}${token}` })
        }}
      />
      {block.rows.length < 12 ? (
        <button
          type="button"
          className="text-sm text-[#355185] hover:underline"
          onClick={() =>
            onChange({
              ...block,
              rows: [...block.rows, { id: crypto.randomUUID(), label: "Label", value: "" }],
            })
          }
        >
          Add row
        </button>
      ) : null}
    </>
  )
}
