"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PriceGuideAdminComps } from "@/components/features/admin/price-guide/price-guide-admin-comps"
import { formatGuideUsd } from "@/lib/price-guide/format"
import type { PriceGuideAdminDetail, PriceGuideConfidence, PriceGuidePricingSource, PriceGuideStatus } from "@/lib/types/price-guide"

export function PriceGuideAdminEditor({ id }: { id: string }) {
  const router = useRouter()
  const [detail, setDetail] = useState<PriceGuideAdminDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch(`/api/admin/price-guide/${id}`)
    const json: unknown = await res.json()
    if (!res.ok) {
      setError("Could not load entry")
      return
    }
    setDetail((json as { data: PriceGuideAdminDetail }).data)
  }

  useEffect(() => {
    void load()
  }, [id])

  async function save(patch: Record<string, unknown>) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/price-guide/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error("Save failed")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm("Delete this guide entry?")) return
    const res = await fetch(`/api/admin/price-guide/${id}`, { method: "DELETE" })
    if (res.ok) router.push("/admin/price-guide")
  }

  if (!detail) {
    return <p className="text-sm text-muted-foreground">{error ?? "Loading…"}</p>
  }

  const { entry, scope, market } = detail

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{scope.category_label}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {scope.model
              ? `${scope.brand?.name} ${scope.model.name}`
              : scope.brand?.name ?? `${scope.category_label} category`}
          </h1>
          <Link href={detail.public_href} className="mt-1 inline-block text-sm underline-offset-4 hover:underline">
            Public page
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void save({ mark_reviewed: true })}>
            Mark reviewed
          </Button>
          <Button type="button" variant="outline" onClick={() => void remove()}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5 rounded-xl border border-border/80 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={entry.status}
                onChange={(event) => void save({ status: event.target.value as PriceGuideStatus })}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </Field>
            <Field label="Pricing source">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={entry.pricing_source}
                onChange={(event) =>
                  void save({ pricing_source: event.target.value as PriceGuidePricingSource })
                }
              >
                <option value="market">Market only</option>
                <option value="mixed">Mixed (editorial fills gaps)</option>
                <option value="editorial">Editorial override</option>
              </select>
            </Field>
            <Field label="Confidence override">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={entry.confidence ?? ""}
                onChange={(event) =>
                  void save({
                    confidence: event.target.value
                      ? (event.target.value as PriceGuideConfidence)
                      : null,
                  })
                }
              >
                <option value="">Use sample size</option>
                <option value="thin">Thin</option>
                <option value="emerging">Emerging</option>
                <option value="solid">Solid</option>
                <option value="expert">Expert</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={entry.featured}
                onChange={(event) => void save({ featured: event.target.checked })}
              />
              Featured on hub
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <MoneyField
              label="Low"
              value={entry.typical_low_usd}
              onSave={(value) => void save({ typical_low_usd: value })}
            />
            <MoneyField
              label="Mid"
              value={entry.typical_mid_usd}
              onSave={(value) => void save({ typical_mid_usd: value })}
            />
            <MoneyField
              label="High"
              value={entry.typical_high_usd}
              onSave={(value) => void save({ typical_high_usd: value })}
            />
            <MoneyField
              label="New retail"
              value={entry.new_retail_usd}
              onSave={(value) => void save({ new_retail_usd: value })}
            />
          </div>

          <Field label="Headline">
            <Input
              defaultValue={entry.headline ?? ""}
              onBlur={(event) => void save({ headline: event.target.value })}
            />
          </Field>
          <Field label="Summary">
            <Textarea
              defaultValue={entry.summary ?? ""}
              onBlur={(event) => void save({ summary: event.target.value })}
            />
          </Field>
          <Field label="Body">
            <Textarea
              className="min-h-32"
              defaultValue={entry.body ?? ""}
              onBlur={(event) => void save({ body: event.target.value })}
            />
          </Field>
          <Field label="Internal notes">
            <Textarea
              defaultValue={entry.notes_internal ?? ""}
              onBlur={(event) => void save({ notes_internal: event.target.value })}
            />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {saving ? <p className="text-xs text-muted-foreground">Saving…</p> : null}
        </div>

        <aside className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-5">
          <h2 className="text-sm font-semibold">Live market</h2>
          <p className="text-3xl font-semibold tabular-nums">{formatGuideUsd(market.typical.mid_usd)}</p>
          <p className="text-xs text-muted-foreground">
            {formatGuideUsd(market.typical.low_usd)} – {formatGuideUsd(market.typical.high_usd)}
          </p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Sold median</dt>
              <dd className="tabular-nums">{formatGuideUsd(market.sold.median_usd)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Asking median</dt>
              <dd className="tabular-nums">{formatGuideUsd(market.asking.median_usd)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Sold / listed</dt>
              <dd className="tabular-nums">
                {market.sold.count} / {market.asking.count}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Auto confidence</dt>
              <dd className="capitalize">{market.confidence}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <PriceGuideAdminComps
        entryId={entry.id}
        comps={detail.comps}
        marketComps={market.recent_sold}
        onChange={() => void load()}
      />
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function MoneyField({
  label,
  value,
  onSave,
}: {
  label: string
  value: number | null
  onSave: (value: number | null) => void
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        defaultValue={value ?? ""}
        onBlur={(event) => {
          const raw = event.target.value.trim()
          onSave(raw === "" ? null : Number(raw))
        }}
      />
    </Field>
  )
}
