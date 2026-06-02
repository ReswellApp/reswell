import { formatCondition } from "@/lib/listing-labels"
import {
  CONSTRUCTION_OPTIONS,
  FACET_PARAM_KEYS,
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS,
  facetOptionLabel,
} from "@/lib/boards-browse-facets"
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
  const l = row.length_label.trim()
  const w = row.width_label.trim()
  const t = row.thickness_label.trim()
  const v = row.volume_label.trim()
  const dimParts = [l, w, t].filter(Boolean)
  if (dimParts.length === 0 && !v) return "Size not set"
  const dims = dimParts.join(" × ")
  if (dims && v) return `${dims} · ${v}`
  return dims || v
}

/** Fin system / plug routing label (shares the marketplace "Fin System" facet labels). */
export function finPlugsDisplayName(f: FinBoxType): string {
  return facetOptionLabel(FACET_PARAM_KEYS.finSystem, f)
}

/** Fin setup / layout label (shares the marketplace "Fin Setup" facet labels). */
export function finBoxesDisplayName(boxes: FinBoxesType): string {
  return facetOptionLabel(FACET_PARAM_KEYS.finSetup, boxes)
}

/** Board construction label (shares the marketplace "Board Construction" facet labels). */
export function materialDisplayName(material: BrandModelVariantMaterial): string {
  return facetOptionLabel(FACET_PARAM_KEYS.construction, material)
}

/**
 * Admin select option lists for catalog variants — sourced from the same facet definitions
 * the marketplace filters use, so the modals stay in lockstep with the browse vocabulary.
 */
export const FIN_BOX_TYPE_ADMIN_OPTIONS: readonly { value: FinBoxType; label: string }[] =
  FIN_SYSTEM_OPTIONS.map((o) => ({ value: o.value as FinBoxType, label: o.label }))

export const FIN_BOXES_ADMIN_OPTIONS: readonly { value: FinBoxesType; label: string }[] =
  FIN_SETUP_OPTIONS.map((o) => ({ value: o.value as FinBoxesType, label: o.label }))

export const VARIANT_MATERIAL_ADMIN_OPTIONS: readonly { value: BrandModelVariantMaterial; label: string }[] =
  CONSTRUCTION_OPTIONS.map((o) => ({ value: o.value as BrandModelVariantMaterial, label: o.label }))

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
