import Image from "next/image"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { ModelPageSectionHeading } from "@/components/features/models/model-page-section"
import { brandProductCategoryLabel } from "@/lib/brand-product-categories"
import { formatBoardType } from "@/lib/listing-labels"
import type { BrandModelVariantRow } from "@/lib/db/brand-model-variants"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
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

export function ModelProductDetails({ page }: { page: ModelPageData }) {
  const { brand, model, variants } = page
  const imageUrl = page.listingImageUrl
  const lengths = uniqueLabels(variants.map((row) => row.length_label))
  const materials = uniqueLabels(variants.map((row) => row.material?.replace(/_/g, " ")))
  const fins = uniqueLabels(variants.map(finLabel))
  const boardType = formatBoardType(model.board_category_slug)

  const specs: { label: string; value: string }[] = [
    { label: "Brand", value: brand.name },
    { label: "Model", value: model.name },
    { label: "Category", value: brandProductCategoryLabel(model.product_category_slug) },
  ]
  if (boardType) specs.push({ label: "Board type", value: boardType })
  if (brand.location_label?.trim()) specs.push({ label: "Made in", value: brand.location_label.trim() })
  if (materials.length) specs.push({ label: "Construction", value: materials.join(", ") })
  if (fins.length) specs.push({ label: "Fin setup", value: fins.join(", ") })

  return (
    <div>
      <ModelPageSectionHeading>Product details</ModelPageSectionHeading>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,18rem)_1fr] lg:gap-8">
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl border border-border/80 bg-background">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={`${brand.name} ${model.name}`}
              fill
              sizes="18rem"
              unoptimized={listingImageShouldBypassOptimization(imageUrl)}
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BrandLogoMark
                name={brand.name}
                logoUrl={brand.logo_url}
                className="h-24 w-24 rounded-2xl text-2xl"
                imageSizes="96px"
              />
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-2xl border border-border/80 bg-background px-5 py-2 sm:px-6">
          <dl className="divide-y divide-border/70">
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

          {model.description?.trim() ? (
            <div className="border-t border-border/70 py-5">
              <h3 className="text-sm font-semibold text-foreground">Overview</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {model.description.trim()}
              </p>
            </div>
          ) : null}

          {lengths.length > 0 ? (
            <div className="border-t border-border/70 py-5">
              <h3 className="text-sm font-semibold text-foreground">Available dimensions</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {variants.slice(0, 12).map((variant) => (
                  <li key={variant.id}>
                    {[variant.length_label, variant.width_label, variant.thickness_label, variant.volume_label]
                      .filter((part) => part.trim())
                      .join(" × ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
