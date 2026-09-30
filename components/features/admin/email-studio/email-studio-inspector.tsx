"use client"

import { useEffect, useState } from "react"
import { Loader2, Plus, RefreshCw, X } from "lucide-react"
import { uploadBlogMediaFile } from "@/lib/blog/upload-blog-media"
import {
  hydrateEmailStudioProductsAction,
  searchEmailStudioProductsAction,
} from "@/lib/actions/emailStudio"
import { emailImageSrc } from "@/lib/email-studio/email-image-url"
import { EMAIL_MERGE_TOKENS } from "@/lib/email-studio/tokens"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type {
  EmailBlock,
  EmailDetailRow,
  EmailStudioProductSnapshot,
} from "@/lib/types/emailStudio"
import { EmailStudioSectionInspector } from "@/components/features/admin/email-studio/email-studio-section-inspector"

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
      {block.type === "section" ? (
        <EmailStudioSectionInspector section={block} onChange={onChange} />
      ) : null}
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
            onFile={(file) => void upload(file, (src) => onChange({ ...block, src: emailImageSrc(src) }))}
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
            onFile={(file) => void upload(file, (imageSrc) => onChange({ ...block, imageSrc: emailImageSrc(imageSrc) }))}
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
      {block.type === "product" ? (
        <ProductFields block={block} onChange={onChange} />
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

function ProductFields({
  block,
  onChange,
}: {
  block: Extract<EmailBlock, { type: "product" }>
  onChange: (block: EmailBlock) => void
}) {
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<EmailStudioProductSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      void searchEmailStudioProductsAction({ query }).then((result) => {
        if ("error" in result) {
          setError(result.error)
          setHits([])
        } else {
          setHits(result.data)
        }
        setLoading(false)
      })
    }, query.trim() ? 220 : 0)
    return () => window.clearTimeout(timer)
  }, [query])

  function add(item: EmailStudioProductSnapshot) {
    if (block.listingIds.includes(item.id) || block.listingIds.length >= 4) return
    onChange({
      ...block,
      listingIds: [...block.listingIds, item.id],
      items: [...block.items, item],
    })
  }

  function remove(id: string) {
    onChange({
      ...block,
      listingIds: block.listingIds.filter((listingId) => listingId !== id),
      items: block.items.filter((item) => item.id !== id),
    })
  }

  async function refresh() {
    setLoading(true)
    setError(null)
    const result = await hydrateEmailStudioProductsAction({ listingIds: block.listingIds })
    setLoading(false)
    if ("error" in result) {
      setError(result.error)
      return
    }
    onChange({ ...block, items: result.data })
  }

  const toggles: { key: "showPrice" | "showCondition" | "showDimensions" | "showBoardType" | "showAvailability"; label: string }[] = [
    { key: "showPrice", label: "Price" },
    { key: "showCondition", label: "Condition" },
    { key: "showDimensions", label: "Dimensions" },
    { key: "showBoardType", label: "Board type" },
    { key: "showAvailability", label: "Availability" },
  ]

  return (
    <div className="space-y-4">
      <div className={fieldClass}>
        <Label>Section title</Label>
        <Input value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} />
      </div>
      <div className={fieldClass}>
        <Label>Button label</Label>
        <Input value={block.ctaLabel} onChange={(event) => onChange({ ...block, ctaLabel: event.target.value })} />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Selected listings ({block.items.length}/4)</Label>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#355185] disabled:opacity-40"
            disabled={loading || block.listingIds.length === 0}
            onClick={() => void refresh()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh live data
          </button>
        </div>
        <div className="space-y-2">
          {block.items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-md border p-2">
              {/* Listing photos come from dynamic marketplace storage. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt="" className="h-12 w-12 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{item.title}</p>
                <p className="text-[11px] text-muted-foreground">{item.priceDisplay || "No price"} · {item.availability}</p>
              </div>
              <button type="button" aria-label={`Remove ${item.title}`} className="rounded p-1 hover:bg-muted" onClick={() => remove(item.id)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
      {block.listingIds.length < 4 ? (
        <div className="space-y-2 border-t pt-4">
          <Label>Find Reswell listings</Label>
          <Input value={query} placeholder="Search listing title…" onChange={(event) => setQuery(event.target.value)} />
          {loading ? <p className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading listings…</p> : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {hits.filter((item) => !block.listingIds.includes(item.id)).map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-muted"
                onClick={() => add(item)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{item.title}</span>
                  <span className="block text-[11px] text-muted-foreground">{item.priceDisplay || "No price"} · {item.availability}</span>
                </span>
                <Plus className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="space-y-2 border-t pt-4">
        <Label>Show product details</Label>
        <div className="grid grid-cols-2 gap-2">
          {toggles.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={block[key]} onChange={(event) => onChange({ ...block, [key]: event.target.checked })} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Price and availability refresh when this email is pushed to Klaviyo.
      </p>
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
        <Input
          value={src}
          placeholder="https:// or a saved /media image"
          onChange={(event) => onChange({ src: event.target.value })}
          onBlur={(event) => onChange({ src: emailImageSrc(event.target.value) })}
        />
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
