import { formatCondition } from "@/lib/listing-labels"
import type { BrandModelVariantCondition, FinBoxType } from "@/lib/validations/brand-model-variants"

/** Optional USD (admin forms); empty string → null. */
export function parseOptionalPriceInput(
  raw: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  const t = raw.trim()
  if (t === "") return { ok: true, value: null }
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, message: "Enter a valid price or leave blank" }
  }
  if (n > 999_999.99) {
    return { ok: false, message: "Price is too large" }
  }
  return { ok: true, value: n }
}

/** Display L × W × T · volume for board model size rows (labels are free text). */
export function formatBrandModelDimensionLabel(row: {
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
}): string {
  return `${row.length_label.trim()} × ${row.width_label.trim()} × ${row.thickness_label.trim()} · ${row.volume_label.trim()}`
}

function finBoxDisplayName(f: FinBoxType): string {
  if (f === "futures") return "Futures"
  if (f === "fcs") return "FCS"
  return "Single fin"
}

/** Full variant line: dims · fin system · condition (matches marketplace listing labels). */
export function formatBrandModelVariantLabel(row: {
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
  fin_box_type: FinBoxType
  condition: BrandModelVariantCondition
  price?: number | null
}): string {
  const base = `${formatBrandModelDimensionLabel(row)} · ${finBoxDisplayName(row.fin_box_type)} · ${formatCondition(row.condition)}`
  if (row.price != null) {
    const n = Number(row.price)
    if (Number.isFinite(n) && n > 0) {
      return `${base} · $${n.toFixed(2)}`
    }
  }
  return base
}
