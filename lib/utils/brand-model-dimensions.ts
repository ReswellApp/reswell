import { formatCondition } from "@/lib/listing-labels"
import type { BrandModelVariantCondition, FinBoxType } from "@/lib/validations/brand-model-variants"

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
}): string {
  return `${formatBrandModelDimensionLabel(row)} · ${finBoxDisplayName(row.fin_box_type)} · ${formatCondition(row.condition)}`
}
