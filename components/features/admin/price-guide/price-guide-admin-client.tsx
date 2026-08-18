"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { PRICE_GUIDE_CATEGORY_OPTIONS, type PriceGuideCategorySlug } from "@/lib/price-guide/categories"
import { formatGuideUsd } from "@/lib/price-guide/format"
import type { PriceGuideAdminCoverageRow, PriceGuideAdminListItem } from "@/lib/types/price-guide"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PriceGuideAdminCreate } from "@/components/features/admin/price-guide/price-guide-admin-create"

export function PriceGuideAdminClient() {
  const [entries, setEntries] = useState<PriceGuideAdminListItem[]>([])
  const [coverage, setCoverage] = useState<PriceGuideAdminCoverageRow[]>([])
  const [category, setCategory] = useState<PriceGuideCategorySlug>("surfboards")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | "draft" | "published">("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ status, category_slug: category })
      if (query.trim()) params.set("q", query.trim())
      const [listRes, coverRes] = await Promise.all([
        fetch(`/api/admin/price-guide?${params.toString()}`),
        fetch(`/api/admin/price-guide/coverage?category_slug=${category}`),
      ])
      const listJson: unknown = await listRes.json()
      const coverJson: unknown = await coverRes.json()
      if (!listRes.ok) throw new Error(readError(listJson))
      if (!coverRes.ok) throw new Error(readError(coverJson))
      setEntries(readRows<PriceGuideAdminListItem>(listJson))
      setCoverage(readRows<PriceGuideAdminCoverageRow>(coverJson))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load price guide")
    } finally {
      setLoading(false)
    }
  }, [category, query, status])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Price Guide</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Attach editorial pricing to brands and models. Market stats already pull from listings,
            sold orders, and board snapshots.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/priceguide" target="_blank">
            View public guide
          </Link>
        </Button>
      </div>

      <PriceGuideAdminCreate
        defaultCategory={category}
        onCreated={async (id) => {
          await load()
          window.location.href = `/admin/price-guide/${id}`
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={category}
          onChange={(event) => setCategory(event.target.value as PriceGuideCategorySlug)}
        >
          {PRICE_GUIDE_CATEGORY_OPTIONS.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value as "all" | "draft" | "published")}
        >
          <option value="all">All statuses</option>
          <option value="draft">Drafts</option>
          <option value="published">Published</option>
        </select>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter entries…"
          className="sm:max-w-xs"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section>
        <h2 className="text-sm font-semibold text-foreground">Guide entries</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-border/80">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Scope</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Reviewed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-3 py-2">
                    <Link href={`/admin/price-guide/${entry.id}`} className="font-medium hover:underline">
                      {entry.model_name
                        ? `${entry.brand_name} ${entry.model_name}`
                        : entry.brand_name ?? entry.category_slug}
                    </Link>
                    <p className="text-xs text-muted-foreground">{entry.category_slug}</p>
                  </td>
                  <td className="px-3 py-2 capitalize text-muted-foreground">
                    {entry.status}
                    {entry.featured ? " · featured" : ""}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {entry.last_reviewed_at?.slice(0, 10) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && entries.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No entries yet.</p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground">Market coverage to attach</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Brands and models that already have listings or sales — start here.
        </p>
        <div className="mt-3 overflow-hidden rounded-xl border border-border/80">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Brand / model</th>
                <th className="px-3 py-2 font-medium">Typical</th>
                <th className="px-3 py-2 font-medium">Sold / listed</th>
                <th className="px-3 py-2 font-medium">Guide</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {coverage.map((row) => (
                <tr key={`${row.brand_id}:${row.brand_model_id ?? row.model_slug ?? ""}`}>
                  <td className="px-3 py-2">
                    <span className="font-medium">{row.brand_name}</span>
                    {row.model_name ? (
                      <span className="text-muted-foreground"> · {row.model_name}</span>
                    ) : (
                      <span className="text-muted-foreground"> · brand</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatGuideUsd(row.mid_usd)}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {row.sold_count} / {row.asking_count}
                  </td>
                  <td className="px-3 py-2">
                    {row.entry_id ? (
                      <Link href={`/admin/price-guide/${row.entry_id}`} className="hover:underline">
                        {row.entry_status}
                      </Link>
                    ) : (
                      <CoverageCreate
                        category={row.category_slug}
                        brandId={row.brand_id}
                        modelId={row.brand_model_id}
                        onCreated={load}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function CoverageCreate({
  category,
  brandId,
  modelId,
  onCreated,
}: {
  category: PriceGuideCategorySlug
  brandId: string
  modelId: string | null
  onCreated: () => Promise<void>
}) {
  const [pending, setPending] = useState(false)

  async function create() {
    setPending(true)
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
      if (!res.ok) throw new Error(readError(json))
      const id = readCreatedId(json)
      if (id) window.location.href = `/admin/price-guide/${id}`
      else await onCreated()
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void create()}
      disabled={pending}
      className="text-xs font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
    >
      {pending ? "Creating…" : "Create guide"}
    </button>
  )
}

function readError(json: unknown): string {
  if (json && typeof json === "object" && "error" in json && typeof json.error === "string") {
    return json.error
  }
  return "Request failed"
}

function readRows<T>(json: unknown): T[] {
  if (!json || typeof json !== "object" || !("data" in json)) return []
  const data = (json as { data?: { rows?: T[] } }).data
  return data?.rows ?? []
}

function readCreatedId(json: unknown): string | null {
  if (!json || typeof json !== "object" || !("data" in json)) return null
  const entry = (json as { data?: { entry?: { id?: string } } }).data?.entry
  return entry?.id ?? null
}
