"use client"

import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatGuideUsd } from "@/lib/price-guide/format"
import type { PriceGuideComp, PriceGuideCompSource } from "@/lib/types/price-guide"

const SOURCES: { value: PriceGuideCompSource; label: string }[] = [
  { value: "reswell", label: "Reswell" },
  { value: "fb_marketplace", label: "Facebook Marketplace" },
  { value: "craigslist", label: "Craigslist" },
  { value: "ebay", label: "eBay" },
  { value: "shop", label: "Shop / retail" },
  { value: "other", label: "Other" },
]

type PriceGuideAdminCompsProps = {
  entryId: string
  comps: PriceGuideComp[]
  marketComps: PriceGuideComp[]
  onChange: () => void
}

export function PriceGuideAdminComps({
  entryId,
  comps,
  marketComps,
  onChange,
}: PriceGuideAdminCompsProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add(form: FormData) {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/price-guide/${entryId}/comps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sold_price_usd: Number(form.get("sold_price_usd")),
          sold_at: String(form.get("sold_at") ?? ""),
          condition: String(form.get("condition") ?? "") || null,
          dimensions: String(form.get("dimensions") ?? "") || null,
          title: String(form.get("title") ?? "") || null,
          source: String(form.get("source") ?? "other"),
          source_url: String(form.get("source_url") ?? "") || null,
          notes: String(form.get("notes") ?? "") || null,
          include_in_public: form.get("include_in_public") === "on",
        }),
      })
      if (!res.ok) throw new Error("Could not add comp")
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add comp")
    } finally {
      setPending(false)
    }
  }

  async function remove(compId: string) {
    const res = await fetch(`/api/admin/price-guide/comps/${compId}`, { method: "DELETE" })
    if (res.ok) onChange()
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-border/80 p-5">
        <h2 className="text-sm font-semibold">Add a comparable sale</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            void add(new FormData(event.currentTarget))
            event.currentTarget.reset()
          }}
        >
          <Field label="Sold price">
            <Input name="sold_price_usd" type="number" required min={1} step="1" />
          </Field>
          <Field label="Sold date">
            <Input name="sold_at" type="date" required />
          </Field>
          <Field label="Condition">
            <Input name="condition" placeholder="excellent" />
          </Field>
          <Field label="Dimensions">
            <Input name="dimensions" placeholder={`6'0 x 19 1/4`} />
          </Field>
          <Field label="Title">
            <Input name="title" placeholder="CI Twin Pin" />
          </Field>
          <Field label="Source">
            <select name="source" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {SOURCES.map((source) => (
                <option key={source.value} value={source.value}>
                  {source.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Source URL">
              <Input name="source_url" type="url" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="include_in_public" defaultChecked />
            Show on public page
          </label>
          <div className="flex items-end justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add comp"}
            </Button>
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

        <ul className="mt-6 divide-y divide-border/70 text-sm">
          {comps.map((comp) => (
            <li key={comp.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="font-medium tabular-nums">{formatGuideUsd(comp.sold_price_usd)}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {comp.sold_at} · {comp.source_label}
                </span>
              </span>
              <button type="button" className="text-xs underline" onClick={() => void remove(comp.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border/80 bg-muted/20 p-5">
        <h2 className="text-sm font-semibold">Marketplace comps already in the book</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {marketComps.map((comp) => (
            <li key={comp.id} className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {comp.sold_at} · {comp.source_label}
              </span>
              <span className="font-medium tabular-nums">{formatGuideUsd(comp.sold_price_usd)}</span>
            </li>
          ))}
          {marketComps.length === 0 ? (
            <li className="text-muted-foreground">No marketplace sales matched this scope yet.</li>
          ) : null}
        </ul>
      </div>
    </section>
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
