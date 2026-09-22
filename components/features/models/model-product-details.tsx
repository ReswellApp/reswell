import type { ReactNode } from "react"
import Link from "next/link"
import { ModelPageSectionHeading } from "@/components/features/models/model-page-section"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { brandProductCategoryLabel } from "@/lib/brand-product-categories"
import { formatBoardType } from "@/lib/listing-labels"
import type { BrandModelVariantRow } from "@/lib/db/brand-model-variants"
import type { ModelPageData } from "@/lib/services/modelPage"

function uniqueLabels(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const label = value?.trim()
    if (!label || seen.has(label)) continue
    seen.add(label)
    out.push(label)
  }
  return out
}

function finLabel(variant: BrandModelVariantRow): string {
  const boxes = variant.fin_boxes?.replace(/_/g, " ")
  const boxType = variant.fin_box_type?.replace(/_/g, " ")
  return [boxes, boxType].filter(Boolean).join(" · ")
}

function dimensionLabel(variant: BrandModelVariantRow): string {
  return [variant.length_label, variant.width_label, variant.thickness_label, variant.volume_label]
    .filter((part) => part.trim())
    .join(" × ")
}

export function ModelProductDetails({ page }: { page: ModelPageData }) {
  const { brand, model, variants } = page
  const materials = uniqueLabels(variants.map((row) => row.material?.replace(/_/g, " ")))
  const fins = uniqueLabels(variants.map(finLabel))
  const dimensions = uniqueLabels(variants.map(dimensionLabel)).slice(0, 12)
  const boardType = formatBoardType(model.board_category_slug)

  const specs: { label: string; value: ReactNode }[] = [
    {
      label: "Brand",
      value: (
        <Link
          href={`${BRANDS_BASE}/${brand.slug}`}
          className="underline-offset-4 hover:underline"
        >
          {brand.name}
        </Link>
      ),
    },
    { label: "Model", value: model.name },
    { label: "Category", value: brandProductCategoryLabel(model.product_category_slug) },
  ]
  if (boardType) specs.push({ label: "Board type", value: boardType })
  if (brand.location_label?.trim()) specs.push({ label: "Made in", value: brand.location_label.trim() })
  if (materials.length) specs.push({ label: "Construction", value: materials.join(", ") })
  if (fins.length) specs.push({ label: "Fin setup", value: fins.join(", ") })
  if (dimensions.length) {
    specs.push({
      label: "Available sizes",
      value: (
        <ul className="flex flex-wrap gap-2">
          {dimensions.map((label) => (
            <li
              key={label}
              className="inline-flex rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground"
            >
              {label}
            </li>
          ))}
        </ul>
      ),
    })
  }

  return (
    <div>
      <ModelPageSectionHeading>Product specs</ModelPageSectionHeading>
      <dl className="mt-6 max-w-3xl divide-y divide-border/70 border-y border-border/70">
        {specs.map((spec) => (
          <div
            key={spec.label}
            className="grid grid-cols-[7.5rem_1fr] gap-4 py-3.5 text-sm sm:grid-cols-[9rem_1fr]"
          >
            <dt className="text-muted-foreground">{spec.label}</dt>
            <dd className="font-medium text-foreground">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
