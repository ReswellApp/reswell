import Link from "next/link"
import { ExternalLink, MapPin } from "lucide-react"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { BrandProductCategoryBadges } from "@/components/brands/brand-product-category-badges"
import { SaveEntitySearchButton } from "@/components/features/saved-search/save-entity-search-button"
import {
  brandPublicWebsiteHref,
  brandStoryLead,
  brandStoryParagraphs,
} from "@/lib/brands/page-content"
import type { BrandRow } from "@/lib/brands/types"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

export function BrandPageIntro({
  brand,
  criteria,
  initialSavedSearchId,
  isLoggedIn,
}: {
  brand: BrandRow
  criteria: BoardSavedSearchCriteria
  initialSavedSearchId: string | null
  isLoggedIn: boolean
}) {
  const website = brandPublicWebsiteHref(brand.website_url)
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

  return (
    <section className="-mx-4 border-b border-border/80 bg-offwhite px-4 pb-10 pt-2 sm:-mx-6 sm:px-6 sm:pb-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:gap-6">
          <BrandLogoMark
            name={brand.name}
            logoUrl={brand.logo_url}
            className="h-20 w-20 rounded-2xl text-xl sm:h-24 sm:w-24 sm:text-2xl"
            imageSizes="(max-width: 640px) 80px, 96px"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {brand.name}
            </h1>

            <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {brand.location_label?.trim() ? (
                <li className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{brand.location_label.trim()}</span>
                </li>
              ) : null}
              {people.map((entry) => (
                <li key={entry.label}>
                  <span className="text-muted-foreground/80">{entry.label}</span>{" "}
                  <span className="font-medium text-foreground/90">{entry.value}</span>
                </li>
              ))}
              {website ? (
                <li>
                  <Link
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Website
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </li>
              ) : null}
            </ul>

            {brand.product_categories.length > 0 ? (
              <BrandProductCategoryBadges
                categories={brand.product_categories}
                className="mt-4"
                size="sm"
              />
            ) : null}

            {lead ? (
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground sm:text-lg">
                {lead}
              </p>
            ) : null}

            {storyParagraphs.length > 0 ? (
              <div
                className={
                  lead
                    ? "mt-4 max-w-2xl space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base"
                    : "mt-5 max-w-2xl space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg"
                }
              >
                {storyParagraphs.map((paragraph, index) => (
                  <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 sm:pt-1">
          <SaveEntitySearchButton
            criteria={criteria}
            label="Save this brand"
            savedLabel="Brand saved"
            savedSearchLabel={brand.name}
            successTitle="Brand saved"
            successDescription={`We'll email you when new ${brand.name} gear is listed on Reswell.`}
            isLoggedIn={isLoggedIn}
            initialSavedSearchId={initialSavedSearchId}
          />
        </div>
      </div>
    </section>
  )
}
