import { MapPin } from "lucide-react"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { BrandProductCategoryBadges } from "@/components/brands/brand-product-category-badges"
import { SaveEntitySearchButton } from "@/components/features/saved-search/save-entity-search-button"
import { brandStoryLead, brandStoryParagraphs } from "@/lib/brands/page-content"
import type { BrandRow } from "@/lib/brands/types"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

function formatCount(n: number): string {
  return n.toLocaleString("en-US")
}

export function BrandPageIntro({
  brand,
  criteria,
  initialSavedSearchId,
  isLoggedIn,
  activeListingCount,
  soldListingCount,
  modelCount,
}: {
  brand: BrandRow
  criteria: BoardSavedSearchCriteria
  initialSavedSearchId: string | null
  isLoggedIn: boolean
  activeListingCount: number
  soldListingCount: number
  modelCount: number
}) {
  const aboutParagraphs = brand.about_paragraphs ?? []
  const lead = brandStoryLead({
    short_description: brand.short_description,
    about_paragraphs: aboutParagraphs,
  })
  const storyParagraphs = brandStoryParagraphs({
    short_description: brand.short_description,
    about_paragraphs: aboutParagraphs,
  })

  const people = [
    brand.lead_shaper_name?.trim()
      ? { label: "Lead shaper", value: brand.lead_shaper_name.trim() }
      : null,
    brand.founder_name?.trim() ? { label: "Founded by", value: brand.founder_name.trim() } : null,
  ].filter(Boolean) as { label: string; value: string }[]

  const stats = [
    { value: formatCount(soldListingCount), label: "Sold" },
    { value: formatCount(activeListingCount), label: "For sale" },
    { value: formatCount(modelCount), label: modelCount === 1 ? "Model" : "Models" },
  ]

  return (
    <section className="-mx-4 sm:-mx-6">
      <div className="relative">
        <div className="overflow-hidden rounded-none bg-[#5574AD] px-4 pb-10 pt-6 sm:rounded-2xl sm:px-6 sm:pb-11 sm:pt-8">
          {/* Spacer reserves logo width so the title never sits under the mark. */}
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="h-20 w-20 shrink-0 sm:h-24 sm:w-24" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
              <div className="min-w-0 pt-0.5">
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                  {brand.name}
                </h1>
                {brand.location_label?.trim() ? (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-white/85">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{brand.location_label.trim()}</span>
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                <dl className="grid grid-cols-3 gap-3 sm:gap-4">
                  {stats.map((stat) => (
                    <div key={stat.label} className="min-w-[4.25rem] text-left sm:min-w-[4.75rem]">
                      <dt className="sr-only">{stat.label}</dt>
                      <dd className="text-lg font-bold tabular-nums tracking-tight text-white sm:text-xl">
                        {stat.value}
                      </dd>
                      <p className="text-[11px] text-white/75 sm:text-xs">{stat.label}</p>
                    </div>
                  ))}
                </dl>

                <SaveEntitySearchButton
                  criteria={criteria}
                  label="Save this brand"
                  savedLabel="Brand saved"
                  savedSearchLabel={brand.name}
                  successTitle="Brand saved"
                  successDescription={`We'll email you when new ${brand.name} gear is listed on Reswell.`}
                  isLoggedIn={isLoggedIn}
                  initialSavedSearchId={initialSavedSearchId}
                  className="w-fit border-white/35 bg-white/15 text-white hover:bg-white/25 hover:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-4 translate-y-1/2 sm:left-6">
          <div className="pointer-events-auto">
            <BrandLogoMark
              name={brand.name}
              logoUrl={brand.logo_url}
              className="h-20 w-20 rounded-full border-4 border-white p-1.5 text-xl shadow-sm sm:h-24 sm:w-24 sm:p-2 sm:text-2xl"
              imageSizes="96px"
            />
          </div>
        </div>
      </div>

      {/* Clearance for the overlapping logo */}
      <div className="h-10 sm:h-12" aria-hidden />

      <div className="space-y-2.5 px-4 sm:space-y-3 sm:px-0">
        {people.length > 0 ? (
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {people.map((entry) => (
              <li key={entry.label}>
                <span className="text-muted-foreground/80">{entry.label}</span>{" "}
                <span className="font-medium text-foreground/90">{entry.value}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {brand.product_categories.length > 0 ? (
          <BrandProductCategoryBadges categories={brand.product_categories} size="sm" />
        ) : null}

        {lead ? (
          <p className="max-w-2xl text-base leading-relaxed text-foreground sm:text-[17px]">{lead}</p>
        ) : null}

        {storyParagraphs.length > 0 ? (
          <div
            className={
              lead
                ? "max-w-2xl space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base"
                : "max-w-2xl space-y-3 text-base leading-relaxed text-muted-foreground"
            }
          >
            {storyParagraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
