"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  PRICE_GUIDE_CATEGORY_OPTIONS,
  type PriceGuideCategorySlug,
} from "@/lib/price-guide/categories"

type CatalogBrand = { id: string; name: string; slug: string }
type CatalogModel = {
  id: string
  name: string
  brand_id: string
  brand_name: string
  brand_slug: string
}

type PriceGuideAdminCreateProps = {
  defaultCategory: PriceGuideCategorySlug
  onCreated: (id: string) => Promise<void>
}

export function PriceGuideAdminCreate({ defaultCategory, onCreated }: PriceGuideAdminCreateProps) {
  const [category, setCategory] = useState<PriceGuideCategorySlug>(defaultCategory)
  const [q, setQ] = useState("")
  const [brands, setBrands] = useState<CatalogBrand[]>([])
  const [models, setModels] = useState<CatalogModel[]>([])
  const [brandId, setBrandId] = useState<string | null>(null)
  const [modelId, setModelId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search(next: string) {
    setQ(next)
    if (next.trim().length < 2) {
      setBrands([])
      setModels([])
      return
    }
    const res = await fetch(`/api/admin/price-guide/catalog?q=${encodeURIComponent(next.trim())}`)
    const json: unknown = await res.json()
    if (!res.ok || !json || typeof json !== "object" || !("data" in json)) return
    const data = json.data as { brands?: CatalogBrand[]; models?: CatalogModel[] }
    setBrands(data.brands ?? [])
    setModels(data.models ?? [])
  }

  async function create() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/price-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_slug: category,
          brand_id: brandId,
          brand_model_id: modelId,
        }),
      })
      const json: unknown = await res.json()
      if (!res.ok) {
        const message =
          json && typeof json === "object" && "error" in json && typeof json.error === "string"
            ? json.error
            : "Could not create guide"
        throw new Error(message)
      }
      const id = (json as { data?: { entry?: { id?: string } } }).data?.entry?.id
      if (!id) throw new Error("Missing entry id")
      await onCreated(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create guide")
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="rounded-xl border border-border/80 bg-muted/20 p-4">
      <h2 className="text-sm font-semibold text-foreground">Create a guide</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Category only, brand, or brand + model. Leave brand empty for a category page.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="pg-cat">Category</Label>
          <select
            id="pg-cat"
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={category}
            onChange={(event) => setCategory(event.target.value as PriceGuideCategorySlug)}
          >
            {PRICE_GUIDE_CATEGORY_OPTIONS.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="pg-search">Find brand or model</Label>
          <Input
            id="pg-search"
            className="mt-1"
            value={q}
            onChange={(event) => void search(event.target.value)}
            placeholder="Channel Islands, Twin Pin…"
          />
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={() => void create()} disabled={pending} className="w-full">
            {pending ? "Creating…" : "Create entry"}
          </Button>
        </div>
      </div>
      {brands.length + models.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <ul className="space-y-1 text-sm">
            {brands.map((brand) => (
              <li key={brand.id}>
                <button
                  type="button"
                  onClick={() => {
                    setBrandId(brand.id)
                    setModelId(null)
                  }}
                  className={brandId === brand.id ? "font-semibold" : "text-muted-foreground"}
                >
                  Brand · {brand.name}
                </button>
              </li>
            ))}
          </ul>
          <ul className="space-y-1 text-sm">
            {models.map((model) => (
              <li key={model.id}>
                <button
                  type="button"
                  onClick={() => {
                    setBrandId(model.brand_id)
                    setModelId(model.id)
                  }}
                  className={modelId === model.id ? "font-semibold" : "text-muted-foreground"}
                >
                  {model.brand_name} {model.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </section>
  )
}
