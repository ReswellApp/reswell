import { formatCondition } from "@/lib/listing-labels"
import type {
  BrandModelVariantCondition,
  BrandModelVariantMaterial,
  FinBoxesType,
  FinBoxType,
} from "@/lib/validations/brand-model-variants"

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

function finPlugsDisplayName(f: FinBoxType): string {
  if (f === "futures") return "Futures"
  if (f === "fcs") return "FCS"
  return "Single fin"
}

export function finBoxesDisplayName(boxes: FinBoxesType): string {
  switch (boxes) {
    case "five_fin":
      return "Five fin"
    case "thruster":
      return "Thruster"
    case "quad":
      return "Quad"
    case "single_fin":
      return "Single fin"
    case "two_plus_one":
      return "2+1"
    case "twinzer":
      return "Twinzer"
    default:
      return boxes
  }
}

export function materialDisplayName(material: BrandModelVariantMaterial): string {
  return material === "eps" ? "EPS" : "PU"
}

export const FIN_BOXES_ADMIN_OPTIONS: readonly { value: FinBoxesType; label: string }[] = [
  { value: "five_fin", label: "Five fin" },
  { value: "thruster", label: "Thruster" },
  { value: "quad", label: "Quad" },
  { value: "single_fin", label: "Single fin" },
  { value: "two_plus_one", label: "2+1" },
  { value: "twinzer", label: "Twinzer" },
] as const

export const VARIANT_MATERIAL_ADMIN_OPTIONS: readonly { value: BrandModelVariantMaterial; label: string }[] = [
  { value: "pu", label: "PU" },
  { value: "eps", label: "EPS" },
] as const

/** Full variant line: dims · fin plugs · fin boxes · PU/EPS foam · condition. */
export function formatBrandModelVariantLabel(row: {
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
  fin_box_type: FinBoxType
  fin_boxes: FinBoxesType
  material: BrandModelVariantMaterial
  condition: BrandModelVariantCondition
  price?: number | null
}): string {
  const plugs = finPlugsDisplayName(row.fin_box_type)
  const layout = finBoxesDisplayName(row.fin_boxes)
  const foam = materialDisplayName(row.material)
  const base = `${formatBrandModelDimensionLabel(row)} · ${plugs} · ${layout} · ${foam} · ${formatCondition(row.condition)}`
  if (row.price != null) {
    const n = Number(row.price)
    if (Number.isFinite(n) && n > 0) {
      return `${base} · $${n.toFixed(2)}`
    }
  }
  return base
}
