"use client"

import type { ReactNode } from "react"
import { useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Download,
  Filter,
  Image as ImageIcon,
  Layers,
  Link2,
  Package,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  Sparkles,
  Tag,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BrandEditorDialog } from "@/components/brands/brand-editor-dialog"
import { BrandModelEditorDialog } from "@/components/brands/brand-model-editor-dialog"
import type { BrandCatalogBrandNode } from "@/lib/services/brandCatalogOverview"
import type { BrandModelVariantRow } from "@/lib/db/brand-model-variants"
import type { FinBoxType } from "@/lib/validations/brand-model-variants"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { finBoxesDisplayName, finPlugsDisplayName, materialDisplayName } from "@/lib/utils/brand-model-dimensions"
import { formatCondition } from "@/lib/listing-labels"
import { cn } from "@/lib/utils"
import { brandLogoDisplaySrc } from "@/lib/public-media-display-src"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL = "all"

const CONDITION_ORDER = ["brand_new", "excellent", "very_good", "good", "fair", "poor"] as const
const CONDITION_PALETTE: Record<string, string> = {
  brand_new: "#0F172A",
  excellent: "#1E40AF",
  very_good: "#0EA5E9",
  good: "#14B8A6",
  fair: "#F59E0B",
  poor: "#EF4444",
}

const MATERIAL_PALETTE: Record<string, string> = {
  pu_poly: "#1E40AF",
  eps_epoxy: "#14B8A6",
  carbon: "#0F172A",
  other: "#94A3B8",
}
const MATERIAL_ORDER = ["eps_epoxy", "pu_poly", "carbon", "other"] as const

const FIN_LAYOUT_ORDER = [
  "single",
  "twin_only",
  "twin",
  "thruster",
  "quad",
  "five",
  "other",
] as const
const FIN_PALETTE = ["#1E40AF", "#0EA5E9", "#14B8A6", "#A855F7", "#F59E0B", "#EF4444", "#64748B"]

const PRICE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "< $300", min: 0, max: 300 },
  { label: "$300–500", min: 300, max: 500 },
  { label: "$500–700", min: 500, max: 700 },
  { label: "$700–900", min: 700, max: 900 },
  { label: "$900–1.2k", min: 900, max: 1200 },
  { label: "$1.2k–1.5k", min: 1200, max: 1500 },
  { label: "$1.5k+", min: 1500, max: Number.POSITIVE_INFINITY },
]

const BRAND_SORT_OPTIONS = [
  { value: "variants", label: "Most variants" },
  { value: "models", label: "Most models" },
  { value: "value", label: "Highest catalog value" },
  { value: "name", label: "Name (A→Z)" },
  { value: "incomplete", label: "Least complete first" },
] as const
type BrandSortKey = (typeof BRAND_SORT_OPTIONS)[number]["value"]

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

function formatUsd(value: number | null | undefined, opts?: { compact?: boolean }): string {
  if (value == null || !Number.isFinite(value)) return "—"
  if (opts?.compact) {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`
  }
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  })
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US")
}

function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—"
  return `${(value * 100).toFixed(digits)}%`
}

function finPlugsLabel(t: BrandModelVariantRow["fin_box_type"]): string {
  return finPlugsDisplayName(t as FinBoxType)
}

function isValidImg(src: string | null | undefined): src is string {
  const u = src?.trim()
  return Boolean(u && URL.canParse(u))
}

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

// ---------------------------------------------------------------------------
// Derived metrics
// ---------------------------------------------------------------------------

type BrandMetrics = {
  modelCount: number
  variantCount: number
  modelsWithVariants: number
  modelsWithImages: number
  variantsWithImages: number
  pricedCount: number
  priceSum: number
  avgPrice: number | null
  minPrice: number | null
  maxPrice: number | null
  /** 0..1 average of (models-with-variants, models-with-images, variants-priced, variants-imaged). */
  completeness: number
}

function computeBrandMetrics(node: BrandCatalogBrandNode): BrandMetrics {
  let variantCount = 0
  let modelsWithVariants = 0
  let modelsWithImages = 0
  let variantsWithImages = 0
  let pricedCount = 0
  let priceSum = 0
  let minPrice: number | null = null
  let maxPrice: number | null = null

  for (const { model, variants } of node.models) {
    if (isValidImg(model.image_url)) modelsWithImages += 1
    if (variants.length > 0) modelsWithVariants += 1
    variantCount += variants.length
    for (const v of variants) {
      if (isValidImg(v.image_url)) variantsWithImages += 1
      if (v.price != null && Number.isFinite(v.price)) {
        pricedCount += 1
        priceSum += v.price
        minPrice = minPrice == null ? v.price : Math.min(minPrice, v.price)
        maxPrice = maxPrice == null ? v.price : Math.max(maxPrice, v.price)
      }
    }
  }

  const modelCount = node.models.length
  const ratios: number[] = []
  if (modelCount > 0) {
    ratios.push(modelsWithVariants / modelCount)
    ratios.push(modelsWithImages / modelCount)
  }
  if (variantCount > 0) {
    ratios.push(pricedCount / variantCount)
    ratios.push(variantsWithImages / variantCount)
  }
  const completeness = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0

  return {
    modelCount,
    variantCount,
    modelsWithVariants,
    modelsWithImages,
    variantsWithImages,
    pricedCount,
    priceSum,
    avgPrice: pricedCount > 0 ? priceSum / pricedCount : null,
    minPrice,
    maxPrice,
    completeness,
  }
}

type Filters = {
  search: string
  brandId: string
  condition: string
  material: string
  finLayout: string
  onlyIncomplete: boolean
  onlyWithVariants: boolean
}

const EMPTY_FILTERS: Filters = {
  search: "",
  brandId: ALL,
  condition: ALL,
  material: ALL,
  finLayout: ALL,
  onlyIncomplete: false,
  onlyWithVariants: false,
}

function variantMatchesAttributeFilters(v: BrandModelVariantRow, f: Filters): boolean {
  if (f.condition !== ALL && v.condition !== f.condition) return false
  if (f.material !== ALL && v.material !== f.material) return false
  if (f.finLayout !== ALL && v.fin_boxes !== f.finLayout) return false
  return true
}

function variantMatchesSearch(v: BrandModelVariantRow, q: string): boolean {
  if (!q) return true
  const hay = [
    v.id,
    v.length_label,
    v.width_label,
    v.thickness_label,
    v.volume_label,
    v.fin_box_type,
    v.fin_boxes,
    v.material,
    v.condition,
  ]
    .join(" ")
    .toLowerCase()
  return hay.includes(q)
}

// ---------------------------------------------------------------------------
// Small UI primitives (PRO design language)
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  subtitle,
  icon,
  accent,
  footer,
}: {
  label: string
  value: string
  subtitle?: string
  icon: ReactNode
  accent: "primary" | "sky" | "teal" | "amber" | "violet" | "rose" | "emerald"
  footer?: ReactNode
}) {
  const accentBar: Record<typeof accent, string> = {
    primary: "bg-blue-600",
    sky: "bg-sky-500",
    teal: "bg-teal-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    rose: "bg-rose-500",
    emerald: "bg-emerald-500",
  }
  const iconTint: Record<typeof accent, string> = {
    primary: "bg-blue-50 text-blue-600",
    sky: "bg-sky-50 text-sky-600",
    teal: "bg-teal-50 text-teal-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    rose: "bg-rose-50 text-rose-600",
    emerald: "bg-emerald-50 text-emerald-600",
  }
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <span className={cn("absolute inset-y-0 left-0 w-1", accentBar[accent])} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconTint[accent])}>
          {icon}
        </span>
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  )
}

function SectionCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6", className)}>
      {children}
    </div>
  )
}

function SectionHeader({
  title,
  description,
  icon,
  trailing,
}: {
  title: string
  description?: string
  icon?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-slate-400">{icon}</span> : null}
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        {description ? <p className="mt-1 max-w-2xl text-xs text-slate-500">{description}</p> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  )
}

function ProgressMeter({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? value / total : 0
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className="text-xs tabular-nums text-slate-500">
          {formatNumber(value)}/{formatNumber(total)} · {formatPercent(pct)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 0.75 ? "bg-emerald-500" : pct >= 0.4 ? "bg-amber-500" : "bg-rose-500",
          )}
          style={{ width: `${Math.max(pct * 100, value > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  )
}

function Pill({
  children,
  tone = "slate",
  title,
}: {
  children: ReactNode
  tone?: "slate" | "blue" | "teal" | "amber" | "emerald" | "rose"
  title?: string
}) {
  const tones: Record<typeof tone, string> = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  }
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[160px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">
      {children}
    </div>
  )
}

function CompletenessBadge({ value }: { value: number }) {
  const tone = value >= 0.75 ? "emerald" : value >= 0.4 ? "amber" : "rose"
  return (
    <Pill tone={tone} title="Catalog completeness — variants present, images, and prices">
      {formatPercent(value)} complete
    </Pill>
  )
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

type BarDatum = { name: string; value: number; fill: string }

function HorizontalBars({ data, valueFormatter }: { data: BarDatum[]; valueFormatter?: (n: number) => string }) {
  if (data.length === 0) return <EmptyState>No data yet.</EmptyState>
  const height = Math.max(data.length * 34 + 8, 120)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 8, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "#475569" }}
        />
        <RechartsTooltip
          cursor={{ fill: "rgba(148,163,184,0.12)" }}
          formatter={(v: number | string) => [valueFormatter ? valueFormatter(Number(v)) : v, ""]}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            fontSize: 12,
            boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18} label={{
          position: "right",
          fontSize: 11,
          fill: "#64748b",
          formatter: (v: number) => (valueFormatter ? valueFormatter(Number(v)) : String(v)),
        }}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function DonutChart({ data, centerLabel, centerValue }: { data: BarDatum[]; centerLabel: string; centerValue: string }) {
  const total = data.reduce((a, b) => a + b.value, 0)
  if (total === 0) return <EmptyState>No data yet.</EmptyState>
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <RechartsTooltip
            formatter={(v: number | string, name: string) => [`${v} (${formatPercent(Number(v) / total)})`, name]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
            }}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={62}
            outerRadius={90}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-slate-900">{centerValue}</span>
        <span className="text-[11px] uppercase tracking-wide text-slate-500">{centerLabel}</span>
      </div>
    </div>
  )
}

function ChartLegend({ data, total }: { data: BarDatum[]; total: number }) {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
      {data.map((d) => (
        <li key={d.name} className="flex items-center justify-between gap-2 text-xs">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.fill }} />
            <span className="truncate text-slate-600">{d.name}</span>
          </span>
          <span className="shrink-0 tabular-nums text-slate-500">
            {d.value} · {total > 0 ? formatPercent(d.value / total) : "0%"}
          </span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Variant table
// ---------------------------------------------------------------------------

function VariantImageThumb({ src, label }: { src: string | null | undefined; label: string }) {
  if (!isValidImg(src)) return <span className="tabular-nums text-slate-300">—</span>
  return (
    <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50" title={label}>
      <Image
        src={src}
        alt=""
        fill
        className="object-cover"
        sizes="36px"
        unoptimized={listingImageShouldBypassOptimization(src)}
      />
    </span>
  )
}

function VariantTable({ modelName, variants }: { modelName: string; variants: BrandModelVariantRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[920px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 font-medium">Image</th>
            <th className="px-3 py-2 font-medium">Dims (L × W × T / vol)</th>
            <th className="px-3 py-2 font-medium">Plugs</th>
            <th className="px-3 py-2 font-medium">Fin layout</th>
            <th className="px-3 py-2 font-medium">Foam</th>
            <th className="px-3 py-2 font-medium">Condition</th>
            <th className="px-3 py-2 text-right font-medium">Price</th>
            <th className="px-3 py-2 font-medium">IDs</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
              <td className="px-3 py-2 align-top">
                <VariantImageThumb src={v.image_url} label={`${modelName} — ${v.length_label} × ${v.width_label}`} />
              </td>
              <td className="px-3 py-2 align-top tabular-nums text-slate-700">
                {v.length_label} × {v.width_label} × {v.thickness_label} / {v.volume_label}
              </td>
              <td className="px-3 py-2 align-top text-slate-700">{finPlugsLabel(v.fin_box_type)}</td>
              <td className="px-3 py-2 align-top text-slate-700">{finBoxesDisplayName(v.fin_boxes)}</td>
              <td className="px-3 py-2 align-top text-slate-700">{materialDisplayName(v.material)}</td>
              <td className="px-3 py-2 align-top">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: CONDITION_PALETTE[v.condition] ?? "#94a3b8" }}
                  />
                  <span className="text-slate-700">{formatCondition(v.condition)}</span>
                </span>
              </td>
              <td className="px-3 py-2 text-right align-top tabular-nums">
                {v.price != null ? (
                  <span className="font-medium text-slate-900">{formatUsd(v.price)}</span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="px-3 py-2 align-top font-mono text-[11px] text-slate-400">
                v {shortId(v.id)}
                <br />
                m {shortId(v.brand_model_id)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Brand explorer row
// ---------------------------------------------------------------------------

function BrandRow({
  node,
  metrics,
  open,
  onToggle,
  filters,
  query,
}: {
  node: BrandCatalogBrandNode
  metrics: BrandMetrics
  open: boolean
  onToggle: () => void
  filters: Filters
  query: string
}) {
  const { brand, models } = node

  const visibleModels = useMemo(() => {
    return models
      .map(({ model, variants }) => {
        const filteredVariants = variants.filter(
          (v) => variantMatchesAttributeFilters(v, filters) && variantMatchesSearch(v, query),
        )
        return { model, variants, filteredVariants }
      })
      .filter(({ model, variants, filteredVariants }) => {
        const attrFiltersActive =
          filters.condition !== ALL || filters.material !== ALL || filters.finLayout !== ALL
        if (attrFiltersActive && filteredVariants.length === 0) return false
        if (query) {
          const modelMatch =
            model.name.toLowerCase().includes(query) ||
            model.id.toLowerCase().includes(query) ||
            (model.description?.toLowerCase().includes(query) ?? false)
          const brandMatch =
            brand.name.toLowerCase().includes(query) || brand.slug.toLowerCase().includes(query)
          if (!modelMatch && !brandMatch && filteredVariants.length === 0) return false
        }
        // keep models with no variants only when no attribute filter is active
        if (!attrFiltersActive && variants.length === 0 && filters.onlyWithVariants) return false
        return true
      })
  }, [models, filters, query, brand.name, brand.slug])

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-slate-50"
        aria-expanded={open}
      >
        <ChevronRight
          className={cn("mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform", open && "rotate-90")}
        />
        {isValidImg(brand.logo_url) ? (
          <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <Image
              src={brandLogoDisplaySrc(brand.logo_url)}
              alt={`${brand.name} logo`}
              fill
              className="object-contain p-1"
              sizes="44px"
              unoptimized={listingImageShouldBypassOptimization(brandLogoDisplaySrc(brand.logo_url))}
            />
          </span>
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
            <Boxes className="h-5 w-5" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-semibold text-slate-900">{brand.name}</span>
            <span className="font-mono text-[11px] text-slate-400">{brand.slug}</span>
            <CompletenessBadge value={metrics.completeness} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Pill tone="blue">
              <Layers className="h-3 w-3" />
              {metrics.modelCount} models
            </Pill>
            <Pill tone="teal">
              <Package className="h-3 w-3" />
              {metrics.variantCount} variants
            </Pill>
            <Pill tone="emerald" title="Total of stored variant prices">
              <DollarSign className="h-3 w-3" />
              {formatUsd(metrics.priceSum, { compact: true })}
            </Pill>
            {metrics.avgPrice != null ? (
              <Pill tone="slate" title="Average variant price">
                avg {formatUsd(metrics.avgPrice, { compact: true })}
              </Pill>
            ) : null}
            {metrics.variantCount === 0 ? (
              <Pill tone="rose">
                <AlertTriangle className="h-3 w-3" />
                no variants
              </Pill>
            ) : null}
          </div>
        </div>

        <span className="hidden shrink-0 sm:block" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`${BRANDS_BASE}/${encodeURIComponent(brand.slug)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            <Link2 className="h-3.5 w-3.5" />
            Profile
          </Link>
        </span>
      </button>

      {open ? (
        <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-4">
          <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ProgressMeter label="Models w/ variants" value={metrics.modelsWithVariants} total={metrics.modelCount} />
            <ProgressMeter label="Models w/ image" value={metrics.modelsWithImages} total={metrics.modelCount} />
            <ProgressMeter label="Variants priced" value={metrics.pricedCount} total={metrics.variantCount} />
            <ProgressMeter label="Variants w/ image" value={metrics.variantsWithImages} total={metrics.variantCount} />
          </div>

          {visibleModels.length === 0 ? (
            <EmptyState>No models match the current filters.</EmptyState>
          ) : (
            <div className="space-y-3">
              {visibleModels.map(({ model, variants, filteredVariants }) => {
                const attrFiltersActive =
                  filters.condition !== ALL || filters.material !== ALL || filters.finLayout !== ALL
                const variantsToRender = attrFiltersActive || query ? filteredVariants : variants
                return (
                  <div key={model.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start gap-3">
                      {isValidImg(model.image_url) ? (
                        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                          <Image
                            src={model.image_url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="48px"
                            unoptimized={listingImageShouldBypassOptimization(model.image_url)}
                          />
                        </span>
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-slate-300">
                          <ImageIcon className="h-4 w-4" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-semibold text-slate-900">{model.name}</span>
                          <Pill tone="teal">{variants.length} variants</Pill>
                          <span className="font-mono text-[11px] text-slate-400">id {shortId(model.id)}</span>
                        </div>
                        {model.description?.trim() ? (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{model.description}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3">
                      {variants.length === 0 ? (
                        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-3 text-center text-xs text-slate-400">
                          No rows in brand_model_variants for this model.
                        </p>
                      ) : variantsToRender.length === 0 ? (
                        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-3 text-center text-xs text-slate-400">
                          {variants.length} variant(s) hidden by current filters.
                        </p>
                      ) : (
                        <VariantTable modelName={model.name} variants={variantsToRender} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function BrandCatalogOverviewClient(props: {
  stats?: { brands: number; models: number; variants: number }
  nodes?: BrandCatalogBrandNode[]
  embedded?: boolean
  refreshKey?: number
}) {
  const hasInitialData = props.stats !== undefined && props.nodes !== undefined
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [stats, setStats] = useState(props.stats ?? { brands: 0, models: 0, variants: 0 })
  const [nodes, setNodes] = useState<BrandCatalogBrandNode[]>(props.nodes ?? [])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingCatalog, setLoadingCatalog] = useState(!hasInitialData)

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<BrandSortKey>("variants")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [brandDialogOpen, setBrandDialogOpen] = useState(false)
  const [modelsDialogOpen, setModelsDialogOpen] = useState(false)

  const brandOptions = useMemo(
    () => nodes.map((n) => ({ id: n.brand.id, name: n.brand.name })),
    [nodes],
  )

  const loadCatalog = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch("/api/admin/brand-catalog-overview", { credentials: "include" })
      const body = (await res.json().catch(() => ({}))) as {
        data?: { stats: { brands: number; models: number; variants: number }; nodes: BrandCatalogBrandNode[] }
        error?: string
      }
      if (!res.ok || !body.data) {
        setLoadError(typeof body.error === "string" ? body.error : "Could not load brand catalog")
        return
      }
      setStats(body.data.stats)
      setNodes(body.data.nodes)
    } catch {
      setLoadError("Could not load brand catalog")
    } finally {
      setLoadingCatalog(false)
    }
  }, [])

  const refreshData = useCallback(() => {
    startRefresh(() => {
      void loadCatalog()
      router.refresh()
    })
  }, [loadCatalog, router, startRefresh])

  useEffect(() => {
    if (hasInitialData && (props.refreshKey ?? 0) === 0) return
    setLoadingCatalog(true)
    void loadCatalog()
  }, [hasInitialData, loadCatalog, props.refreshKey])

  const deferredSearch = useDeferredValue(filters.search)
  const query = deferredSearch.trim().toLowerCase()

  const patch = useCallback((p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p })), [])

  // --- Per-brand metrics (computed once per data set) ---
  const metricsByBrand = useMemo(() => {
    const map = new Map<string, BrandMetrics>()
    for (const node of nodes) map.set(node.brand.id, computeBrandMetrics(node))
    return map
  }, [nodes])

  // --- Catalog-wide aggregates ---
  const aggregate = useMemo(() => {
    let variants = 0
    let priced = 0
    let priceSum = 0
    let withImage = 0
    let modelsWithVariants = 0
    let modelsWithImages = 0
    let minPrice: number | null = null
    let maxPrice: number | null = null
    let brandsWithModels = 0
    let emptyBrands = 0
    const condition: Record<string, number> = {}
    const material: Record<string, number> = {}
    const finLayout: Record<string, number> = {}
    const priceHist = PRICE_BUCKETS.map((b) => ({ ...b, count: 0 }))

    for (const node of nodes) {
      const m = metricsByBrand.get(node.brand.id)
      if (!m) continue
      if (m.modelCount > 0) brandsWithModels += 1
      if (m.variantCount === 0) emptyBrands += 1
      modelsWithVariants += m.modelsWithVariants
      modelsWithImages += m.modelsWithImages
      for (const { variants: vs } of node.models) {
        for (const v of vs) {
          variants += 1
          condition[v.condition] = (condition[v.condition] ?? 0) + 1
          material[v.material] = (material[v.material] ?? 0) + 1
          finLayout[v.fin_boxes] = (finLayout[v.fin_boxes] ?? 0) + 1
          if (isValidImg(v.image_url)) withImage += 1
          if (v.price != null && Number.isFinite(v.price)) {
            priced += 1
            priceSum += v.price
            minPrice = minPrice == null ? v.price : Math.min(minPrice, v.price)
            maxPrice = maxPrice == null ? v.price : Math.max(maxPrice, v.price)
            const bucket = priceHist.find((b) => v.price! >= b.min && v.price! < b.max)
            if (bucket) bucket.count += 1
          }
        }
      }
    }

    return {
      variants,
      priced,
      priceSum,
      withImage,
      modelsWithVariants,
      modelsWithImages,
      minPrice,
      maxPrice,
      brandsWithModels,
      emptyBrands,
      avgPrice: priced > 0 ? priceSum / priced : null,
      condition,
      material,
      finLayout,
      priceHist,
    }
  }, [nodes, metricsByBrand])

  // --- Chart data ---
  const topByVariants = useMemo<BarDatum[]>(() => {
    return [...nodes]
      .map((n) => ({
        name: n.brand.name,
        value: metricsByBrand.get(n.brand.id)?.variantCount ?? 0,
        fill: "#1E40AF",
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [nodes, metricsByBrand])

  const topByModels = useMemo<BarDatum[]>(() => {
    return [...nodes]
      .map((n) => ({
        name: n.brand.name,
        value: metricsByBrand.get(n.brand.id)?.modelCount ?? 0,
        fill: "#0EA5E9",
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [nodes, metricsByBrand])

  const conditionData = useMemo<BarDatum[]>(() => {
    return CONDITION_ORDER.filter((c) => (aggregate.condition[c] ?? 0) > 0).map((c) => ({
      name: formatCondition(c),
      value: aggregate.condition[c] ?? 0,
      fill: CONDITION_PALETTE[c] ?? "#94a3b8",
    }))
  }, [aggregate.condition])

  const materialData = useMemo<BarDatum[]>(() => {
    return MATERIAL_ORDER.filter((mt) => (aggregate.material[mt] ?? 0) > 0).map((mt) => ({
      name: materialDisplayName(mt),
      value: aggregate.material[mt] ?? 0,
      fill: MATERIAL_PALETTE[mt] ?? "#94a3b8",
    }))
  }, [aggregate.material])

  const finData = useMemo<BarDatum[]>(() => {
    return FIN_LAYOUT_ORDER.filter((f) => (aggregate.finLayout[f] ?? 0) > 0).map((f, i) => ({
      name: finBoxesDisplayName(f),
      value: aggregate.finLayout[f] ?? 0,
      fill: FIN_PALETTE[i % FIN_PALETTE.length],
    }))
  }, [aggregate.finLayout])

  const priceHistData = useMemo<BarDatum[]>(() => {
    return aggregate.priceHist.map((b, i) => ({
      name: b.label,
      value: b.count,
      fill: FIN_PALETTE[i % FIN_PALETTE.length],
    }))
  }, [aggregate.priceHist])

  // --- Filtered + sorted brand list for the explorer ---
  const visibleNodes = useMemo(() => {
    const attrFiltersActive =
      filters.condition !== ALL || filters.material !== ALL || filters.finLayout !== ALL

    const filtered = nodes.filter((node) => {
      const m = metricsByBrand.get(node.brand.id)
      if (!m) return false
      if (filters.brandId !== ALL && node.brand.id !== filters.brandId) return false
      if (filters.onlyWithVariants && m.variantCount === 0) return false
      if (filters.onlyIncomplete && m.completeness >= 0.999) return false

      // attribute filters: brand must have at least one matching variant
      if (attrFiltersActive) {
        const hasMatch = node.models.some(({ variants }) =>
          variants.some((v) => variantMatchesAttributeFilters(v, filters)),
        )
        if (!hasMatch) return false
      }

      if (query) {
        const brandMatch =
          node.brand.name.toLowerCase().includes(query) ||
          node.brand.slug.toLowerCase().includes(query) ||
          node.brand.id.toLowerCase().includes(query)
        const modelMatch = node.models.some(
          ({ model }) =>
            model.name.toLowerCase().includes(query) ||
            model.id.toLowerCase().includes(query) ||
            (model.description?.toLowerCase().includes(query) ?? false),
        )
        const variantMatch = node.models.some(({ variants }) =>
          variants.some((v) => variantMatchesSearch(v, query)),
        )
        if (!brandMatch && !modelMatch && !variantMatch) return false
      }
      return true
    })

    const sorted = [...filtered].sort((a, b) => {
      const ma = metricsByBrand.get(a.brand.id)!
      const mb = metricsByBrand.get(b.brand.id)!
      switch (sort) {
        case "models":
          return mb.modelCount - ma.modelCount || a.brand.name.localeCompare(b.brand.name)
        case "value":
          return mb.priceSum - ma.priceSum || a.brand.name.localeCompare(b.brand.name)
        case "name":
          return a.brand.name.localeCompare(b.brand.name)
        case "incomplete":
          return ma.completeness - mb.completeness || a.brand.name.localeCompare(b.brand.name)
        case "variants":
        default:
          return mb.variantCount - ma.variantCount || a.brand.name.localeCompare(b.brand.name)
      }
    })
    return sorted
  }, [nodes, metricsByBrand, filters, query, sort])

  const filtersActive =
    query.length > 0 ||
    filters.brandId !== ALL ||
    filters.condition !== ALL ||
    filters.material !== ALL ||
    filters.finLayout !== ALL ||
    filters.onlyIncomplete ||
    filters.onlyWithVariants

  const isOpen = useCallback(
    (brandId: string) => (filtersActive ? true : expanded.has(brandId)),
    [filtersActive, expanded],
  )

  const toggleBrand = useCallback((brandId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(brandId)) next.delete(brandId)
      else next.add(brandId)
      return next
    })
  }, [])

  const expandAll = useCallback(() => setExpanded(new Set(visibleNodes.map((n) => n.brand.id))), [visibleNodes])
  const collapseAll = useCallback(() => setExpanded(new Set()), [])
  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [])

  const exportCsv = useCallback(() => {
    const header = [
      "brand_name",
      "brand_slug",
      "brand_id",
      "model_name",
      "brand_model_id",
      "variant_id",
      "length",
      "width",
      "thickness",
      "volume",
      "fin_plugs",
      "fin_layout",
      "material",
      "condition",
      "price_usd",
      "image_url",
    ]
    const rows: string[] = [header.join(",")]
    for (const node of nodes) {
      for (const { model, variants } of node.models) {
        if (variants.length === 0) {
          rows.push(
            [
              node.brand.name,
              node.brand.slug,
              node.brand.id,
              model.name,
              model.id,
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
            ]
              .map(csvEscape)
              .join(","),
          )
          continue
        }
        for (const v of variants) {
          rows.push(
            [
              node.brand.name,
              node.brand.slug,
              node.brand.id,
              model.name,
              model.id,
              v.id,
              v.length_label,
              v.width_label,
              v.thickness_label,
              v.volume_label,
              finPlugsLabel(v.fin_box_type),
              finBoxesDisplayName(v.fin_boxes),
              materialDisplayName(v.material),
              formatCondition(v.condition),
              v.price ?? "",
              v.image_url ?? "",
            ]
              .map(csvEscape)
              .join(","),
          )
        }
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `reswell-brand-catalog-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [nodes])

  const avgModelsPerBrand = stats.brands > 0 ? stats.models / stats.brands : 0
  const avgVariantsPerModel = stats.models > 0 ? stats.variants / stats.models : 0
  const pricedPct = aggregate.variants > 0 ? aggregate.priced / aggregate.variants : 0
  const imagedPct = aggregate.variants > 0 ? aggregate.withImage / aggregate.variants : 0

  if (loadingCatalog && nodes.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500 shadow-sm">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading brand catalog…
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          {loadError}
        </div>
      ) : null}

      {/* Header */}
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {props.embedded ? (
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                  Brand / model / variant catalog
                </h2>
              ) : (
                <>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    Brand catalog explorer
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                    Pro
                  </span>
                </>
              )}
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {props.embedded ? (
                <>
                  Browse the full catalog and add brands, models, and variants without leaving the market
                  dashboard.
                </>
              ) : (
                <>
                  Live hierarchy of <span className="font-medium text-foreground">brands</span> →{" "}
                  <span className="font-medium text-foreground">brand_models</span> →{" "}
                  <span className="font-medium text-foreground">brand_model_variants</span>. Search, filter, analyze
                  coverage, and export the entire catalog.
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setBrandDialogOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add brand
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setModelsDialogOpen(true)} className="gap-1.5">
              <Layers className="h-4 w-4" />
              Add models
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={refreshData} disabled={refreshing} className="gap-1.5">
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-blue-600" />
            <span className="font-semibold tabular-nums text-foreground">{formatNumber(stats.brands)}</span> brands
          </span>
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-sky-600" />
            <span className="font-semibold tabular-nums text-foreground">{formatNumber(stats.models)}</span> models
          </span>
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4 text-teal-600" />
            <span className="font-semibold tabular-nums text-foreground">{formatNumber(stats.variants)}</span> variants
          </span>
          <span className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold tabular-nums text-foreground">
              {formatUsd(aggregate.priceSum, { compact: true })}
            </span>{" "}
            catalog value
          </span>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Brands"
          value={formatNumber(stats.brands)}
          subtitle={`${formatNumber(aggregate.brandsWithModels)} with models · ${aggregate.emptyBrands} empty`}
          icon={<Boxes className="h-5 w-5" />}
          accent="primary"
        />
        <KpiCard
          label="Models"
          value={formatNumber(stats.models)}
          subtitle={`${avgModelsPerBrand.toFixed(1)} avg per brand`}
          icon={<Layers className="h-5 w-5" />}
          accent="sky"
        />
        <KpiCard
          label="Variants"
          value={formatNumber(stats.variants)}
          subtitle={`${avgVariantsPerModel.toFixed(1)} avg per model`}
          icon={<Package className="h-5 w-5" />}
          accent="teal"
        />
        <KpiCard
          label="Catalog value"
          value={formatUsd(aggregate.priceSum, { compact: true })}
          subtitle={
            aggregate.avgPrice != null
              ? `avg ${formatUsd(aggregate.avgPrice)} · ${formatNumber(aggregate.priced)} priced`
              : "no prices stored"
          }
          icon={<DollarSign className="h-5 w-5" />}
          accent="emerald"
        />
        <KpiCard
          label="Price range"
          value={
            aggregate.minPrice != null && aggregate.maxPrice != null
              ? `${formatUsd(aggregate.minPrice, { compact: true })} – ${formatUsd(aggregate.maxPrice, { compact: true })}`
              : "—"
          }
          subtitle={`${formatPercent(pricedPct)} of variants priced`}
          icon={<Tag className="h-5 w-5" />}
          accent="amber"
        />
        <KpiCard
          label="Media coverage"
          value={formatPercent(imagedPct)}
          subtitle={`${formatNumber(aggregate.withImage)} of ${formatNumber(aggregate.variants)} variants have an image`}
          icon={<ImageIcon className="h-5 w-5" />}
          accent="violet"
        />
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard>
          <SectionHeader
            title="Deepest catalogs (by variants)"
            description="Top brands ranked by number of stored size/fin/condition variants."
            icon={<Package className="h-4 w-4" />}
          />
          <HorizontalBars data={topByVariants} />
        </SectionCard>

        <SectionCard>
          <SectionHeader
            title="Widest catalogs (by models)"
            description="Top brands ranked by number of board models."
            icon={<Layers className="h-4 w-4" />}
          />
          <HorizontalBars data={topByModels} />
        </SectionCard>

        <SectionCard>
          <SectionHeader
            title="Condition mix"
            description="Distribution of variant conditions across the catalog."
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <DonutChart data={conditionData} centerLabel="variants" centerValue={formatNumber(aggregate.variants)} />
          <ChartLegend data={conditionData} total={aggregate.variants} />
        </SectionCard>

        <SectionCard>
          <SectionHeader
            title="Foam material"
            description="PU vs EPS split across all variants."
            icon={<Ruler className="h-4 w-4" />}
          />
          <DonutChart data={materialData} centerLabel="variants" centerValue={formatNumber(aggregate.variants)} />
          <ChartLegend data={materialData} total={aggregate.variants} />
        </SectionCard>

        <SectionCard>
          <SectionHeader
            title="Fin layouts"
            description="How variants break down by fin configuration."
            icon={<Sparkles className="h-4 w-4" />}
          />
          <HorizontalBars data={finData} />
        </SectionCard>

        <SectionCard>
          <SectionHeader
            title="Price distribution"
            description="Priced variants bucketed by USD range."
            icon={<DollarSign className="h-4 w-4" />}
          />
          {aggregate.priced === 0 ? (
            <EmptyState>No variant prices stored yet.</EmptyState>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priceHistData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval={0}
                />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                <RechartsTooltip
                  cursor={{ fill: "rgba(148,163,184,0.12)" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                  {priceHistData.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Toolbar */}
      <SectionCard className="p-4 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={filters.search}
                onChange={(e) => patch({ search: e.target.value })}
                placeholder="Search brands, models, variants, dimensions, IDs…"
                className="pl-9"
              />
              {filters.search ? (
                <button
                  type="button"
                  onClick={() => patch({ search: "" })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sort} onValueChange={(v) => setSort(v as BrandSortKey)}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRAND_SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={expandAll} disabled={filtersActive}>
                Expand all
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} disabled={filtersActive}>
                Collapse all
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </span>
            <Select value={filters.brandId} onValueChange={(v) => patch({ brandId: v })}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All brands</SelectItem>
                {nodes.map((n) => (
                  <SelectItem key={n.brand.id} value={n.brand.id}>
                    {n.brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.condition} onValueChange={(v) => patch({ condition: v })}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="Condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any condition</SelectItem>
                {CONDITION_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>
                    {formatCondition(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.material} onValueChange={(v) => patch({ material: v })}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Construction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any construction</SelectItem>
                {MATERIAL_ORDER.map((mt) => (
                  <SelectItem key={mt} value={mt}>
                    {materialDisplayName(mt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.finLayout} onValueChange={(v) => patch({ finLayout: v })}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Fin setup" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any fin setup</SelectItem>
                {FIN_LAYOUT_ORDER.map((f) => (
                  <SelectItem key={f} value={f}>
                    {finBoxesDisplayName(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => patch({ onlyWithVariants: !filters.onlyWithVariants })}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                filters.onlyWithVariants
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50",
              )}
            >
              Has variants
            </button>
            <button
              type="button"
              onClick={() => patch({ onlyIncomplete: !filters.onlyIncomplete })}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                filters.onlyIncomplete
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50",
              )}
            >
              Needs attention
            </button>
            {filtersActive ? (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-slate-500">
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}
            <span className="ml-auto text-xs tabular-nums text-slate-500">
              Showing {formatNumber(visibleNodes.length)} of {formatNumber(nodes.length)} brands
            </span>
          </div>
        </div>
      </SectionCard>

      {/* Explorer */}
      {visibleNodes.length === 0 ? (
        <SectionCard>
          <EmptyState>
            {nodes.length === 0 ? "No brands in the database yet." : "No brands match the current filters."}
          </EmptyState>
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {visibleNodes.map((node) => (
            <BrandRow
              key={node.brand.id}
              node={node}
              metrics={metricsByBrand.get(node.brand.id)!}
              open={isOpen(node.brand.id)}
              onToggle={() => toggleBrand(node.brand.id)}
              filters={filters}
              query={query}
            />
          ))}
        </div>
      )}

      <p className="pt-2 text-center text-xs text-slate-400">
        Live snapshot · brands → brand_models → brand_model_variants · {formatNumber(stats.brands)} brands ·{" "}
        {formatNumber(stats.models)} models · {formatNumber(stats.variants)} variants
      </p>

      <BrandEditorDialog
        open={brandDialogOpen}
        onOpenChange={setBrandDialogOpen}
        mode="create"
        brand={null}
        redirectOnCreate={false}
        onSaved={refreshData}
      />
      <BrandModelEditorDialog
        open={modelsDialogOpen}
        onOpenChange={(next) => {
          setModelsDialogOpen(next)
          if (!next) refreshData()
        }}
        brands={brandOptions}
      />
    </div>
  )
}
