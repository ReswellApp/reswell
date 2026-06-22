import { FIN_CATALOG_PRODUCT_CATEGORY } from "@/lib/brand-catalog-fin-variants"
import { finBoxesDisplayName, finPlugsDisplayName } from "@/lib/utils/brand-model-dimensions"
import { finSizeLabel } from "@/lib/fin-listing-config"
import type { FinBoxesType, FinBoxType, FinCatalogVariantSize } from "@/lib/validations/brand-model-variants"

export type FinCatalogGeometryFields = {
  fin_base_label: string
  fin_height_label: string
  fin_foil_label: string
}

/** e.g. `Base: 5.05" · Height: 5.63" · Foil: Flat` */
export function formatFinCatalogGeometrySummary(row: FinCatalogGeometryFields): string | null {
  const parts: string[] = []
  const base = row.fin_base_label.trim()
  const height = row.fin_height_label.trim()
  const foil = row.fin_foil_label.trim()
  if (base) parts.push(`Base: ${base}`)
  if (height) parts.push(`Height: ${height}`)
  if (foil) parts.push(`Foil: ${foil}`)
  return parts.length > 0 ? parts.join(" · ") : null
}

/** Human-readable label for a fin catalog variant row. */
export function formatFinCatalogVariantLabel(row: {
  fin_size: FinCatalogVariantSize | null
  configuration_label: string
  fin_color_label?: string
  fin_box_type: FinBoxType
  fin_boxes: FinBoxesType
} & FinCatalogGeometryFields): string {
  const parts: string[] = []
  const geometry = formatFinCatalogGeometrySummary(row)
  if (geometry) parts.push(geometry)
  const sizeLabel = finSizeLabel(row.fin_size)
  if (sizeLabel) parts.push(sizeLabel)
  const config = row.configuration_label.trim()
  if (config) parts.push(config)
  const color = row.fin_color_label?.trim() ?? ""
  if (color) parts.push(color)
  parts.push(finPlugsDisplayName(row.fin_box_type))
  parts.push(finBoxesDisplayName(row.fin_boxes))
  return parts.filter(Boolean).join(" · ")
}

export function isFinCatalogProductCategory(slug: string | null | undefined): boolean {
  return slug === FIN_CATALOG_PRODUCT_CATEGORY
}
