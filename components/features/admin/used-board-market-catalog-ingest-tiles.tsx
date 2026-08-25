"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { formatDistanceToNow, parseISO } from "date-fns"
import { Boxes, Loader2 } from "lucide-react"
import { BRANDS_BASE } from "@/lib/brands/routes"
import type {
  BrandCatalogRecentBrand,
  BrandCatalogRecentModel,
  BrandCatalogRecentSnapshot,
} from "@/lib/services/brandCatalogRecent"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { brandLogoDisplaySrc } from "@/lib/public-media-display-src"

function formatCount(value: number): string {
  return value.toLocaleString("en-US")
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return "recently"
  }
}

type IngestBrandRow = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  isNewBrand: boolean
  latestAt: string
  models: { id: string; name: string }[]
}

function buildIngestRows(
  brands: BrandCatalogRecentBrand[],
  models: BrandCatalogRecentModel[],
): IngestBrandRow[] {
  const byId = new Map<string, IngestBrandRow>()

  for (const brand of brands) {
    byId.set(brand.id, {
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      logoUrl: brand.logoUrl,
      isNewBrand: true,
      latestAt: brand.createdAt,
      models: [],
    })
  }

  for (const model of models) {
    const existing = byId.get(model.brand.id)
    if (existing) {
      existing.models.push({ id: model.id, name: model.name })
      if (model.createdAt > existing.latestAt) existing.latestAt = model.createdAt
      continue
    }
    byId.set(model.brand.id, {
      id: model.brand.id,
      slug: model.brand.slug,
      name: model.brand.name,
      logoUrl: null,
      isNewBrand: false,
      latestAt: model.createdAt,
      models: [{ id: model.id, name: model.name }],
    })
  }

  return [...byId.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt))
}

function BrandMark({ logoUrl }: { logoUrl: string | null }) {
  const logoSrc = logoUrl ? brandLogoDisplaySrc(logoUrl) : ""
  if (logoSrc) {
    return (
      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
        <Image
          src={logoSrc}
          alt=""
          fill
          className="object-contain p-0.5"
          sizes="28px"
          unoptimized={listingImageShouldBypassOptimization(logoSrc)}
        />
      </span>
    )
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400">
      <Boxes className="h-3.5 w-3.5" />
    </span>
  )
}

export function UsedBoardMarketCatalogIngestTiles({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<BrandCatalogRecentSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      try {
        const res = await fetch("/api/admin/brand-catalog-recent", { credentials: "include" })
        const body = (await res.json().catch(() => ({}))) as {
          data?: BrandCatalogRecentSnapshot
          error?: string
        }
        if (cancelled) return
        if (!res.ok || !body.data) {
          setError(typeof body.error === "string" ? body.error : "Could not load catalog ingest")
          setData(null)
          return
        }
        setData(body.data)
      } catch {
        if (!cancelled) {
          setError("Could not load catalog ingest")
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const rows = useMemo(
    () => (data ? buildIngestRows(data.recentBrands, data.recentModels) : []),
    [data],
  )

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold text-slate-900">Catalog ingest</h3>
          {data ? (
            <p className="text-xs text-slate-500">
              <span className="font-semibold tabular-nums text-slate-800">
                {formatCount(data.brandsLast24h)}
              </span>{" "}
              brands ·{" "}
              <span className="font-semibold tabular-nums text-slate-800">
                {formatCount(data.modelsLast24h)}
              </span>{" "}
              models in 24h
              <span className="text-slate-400">
                {" "}
                · {formatCount(data.brandsLast7d)} / {formatCount(data.modelsLast7d)} this week
              </span>
            </p>
          ) : null}
        </div>
        <Link
          href="/admin/used-board-market-dashboard?tab=catalog"
          className="text-xs font-medium text-blue-700 underline-offset-4 hover:underline"
        >
          Open catalog
        </Link>
      </div>

      {loading ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading recent additions…
        </div>
      ) : error ? (
        <p className="mt-2 text-xs text-rose-700">{error}</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No brands or models added in the last 7 days.</p>
      ) : (
        <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100">
          {rows.map((row) => {
            const preview = row.models.slice(0, 3).map((model) => model.name)
            const extra = row.models.length - preview.length
            return (
              <li key={row.id}>
                <Link
                  href={`${BRANDS_BASE}/${row.slug}`}
                  className="flex items-start gap-2.5 px-2.5 py-1.5 hover:bg-slate-50"
                >
                  <BrandMark logoUrl={row.logoUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">{row.name}</span>
                      {row.isNewBrand ? (
                        <span className="shrink-0 rounded bg-sky-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                          New
                        </span>
                      ) : null}
                      <span className="ml-auto shrink-0 text-[11px] text-slate-400">
                        {relativeTime(row.latestAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {row.models.length > 0 ? (
                        <>
                          {formatCount(row.models.length)} model{row.models.length === 1 ? "" : "s"}
                          {preview.length > 0 ? ` · ${preview.join(", ")}` : ""}
                          {extra > 0 ? ` +${extra}` : ""}
                        </>
                      ) : (
                        "Brand added"
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
