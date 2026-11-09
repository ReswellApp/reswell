import { ModelPageSectionHeading } from "@/components/features/models/model-page-section"
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

export type ModelProductDetail = {
  description: string | null
  sizes: string[]
  facts: { label: string; value: string }[]
}

/** Facts that are not already in the title. Null when the section would only repeat the header. */
export function getModelProductDetail(page: ModelPageData): ModelProductDetail | null {
  const description = page.model.description?.trim() || null
  const sizes = uniqueLabels(page.variants.map(dimensionLabel)).slice(0, 12)
  const materials = uniqueLabels(page.variants.map((row) => row.material?.replace(/_/g, " ")))
  const fins = uniqueLabels(page.variants.map(finLabel))
  const facts: { label: string; value: string }[] = []
  if (materials.length) facts.push({ label: "Construction", value: materials.join(", ") })
  if (fins.length) facts.push({ label: "Fin setup", value: fins.join(", ") })
  if (!description && sizes.length === 0 && facts.length === 0) return null
  return { description, sizes, facts }
}

export function ModelProductDetails({ detail }: { detail: ModelProductDetail }) {
  return (
    <div>
      <ModelPageSectionHeading>Details</ModelPageSectionHeading>
      {detail.description ? (
        <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {detail.description}
        </p>
      ) : null}
      {detail.sizes.length > 0 ? (
        <div className={detail.description ? "mt-6" : "mt-4"}>
          <h3 className="text-sm font-medium text-foreground">Sizes</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {detail.sizes.map((label) => (
              <li
                key={label}
                className="inline-flex rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground"
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {detail.facts.length > 0 ? (
        <dl className="mt-6 max-w-3xl divide-y divide-border/70 border-y border-border/70">
          {detail.facts.map((fact) => (
            <div
              key={fact.label}
              className="grid grid-cols-[7.5rem_1fr] gap-4 py-3.5 text-sm sm:grid-cols-[9rem_1fr]"
            >
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="font-medium text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}
