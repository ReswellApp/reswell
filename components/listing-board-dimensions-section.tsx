import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  formatListingGeometryLine,
  formatListingVolumePart,
  type ListingDimensionsWithDisplay,
} from "@/lib/listing-dimensions-display"

type ListingBoardDimensionsBlockProps = {
  listingId: string
  dimensions: ListingDimensionsWithDisplay
  className?: string
  /** Surfboard listing brand label from sell flow / catalog (linked when `brandHref` is set). */
  brandLabel?: string | null
  /** `/brands/[slug]` when the listing is tied to a catalog brand (`brand_id`). */
  brandHref?: string | null
  /** Model name from sell flow (`listings.model`). */
  modelLabel?: string | null
}

/**
 * Renders board dimensions (and optional brand / model from the sell form) above the description.
 * Uses the listing row from the detail query (same source as `select *`) so we never request
 * columns that may not exist yet in the DB.
 */
export function ListingBoardDimensionsBlock({
  listingId,
  dimensions,
  className,
  brandLabel,
  brandHref,
  modelLabel,
}: ListingBoardDimensionsBlockProps) {
  const geometry = formatListingGeometryLine(dimensions)
  const volume = formatListingVolumePart(dimensions)

  const stored = dimensions.dimensions?.trim()
  const looksLikeStoredPartialDimensionsJson =
    typeof stored === "string" &&
    stored.startsWith("{") &&
    stored.includes('"v"')

  const showUnparsedStoredFallback =
    Boolean(stored) && !geometry && !volume && !looksLikeStoredPartialDimensionsJson

  const hasDims = Boolean(geometry || volume || showUnparsedStoredFallback)

  const brand = brandLabel?.trim() ?? ""
  const model = modelLabel?.trim() ?? ""
  const hasBrandModel = Boolean(brand || model)
  const linkBrand = Boolean(brandHref?.trim())

  if (!hasDims && !hasBrandModel) return null

  const dimsHeadingId = `listing-${listingId}-board-dimensions`
  const brandHeadingId = `listing-${listingId}-brand-model`
  const labelledBy = [hasDims && dimsHeadingId, hasBrandModel && !hasDims && brandHeadingId]
    .filter(Boolean)
    .join(" ")

  return (
    <section
      aria-labelledby={labelledBy || undefined}
      className={cn(
        "rounded-3xl bg-muted/45 px-5 py-4 dark:bg-muted/25",
        className,
      )}
    >
      <div className="flex flex-col gap-3 items-start text-left">
        {hasDims ? (
          <div className="flex w-full flex-col gap-1.5 items-start">
            <h2
              id={dimsHeadingId}
              className="font-sans text-[12px] font-normal uppercase tracking-wide text-foreground"
            >
              Board dimensions
            </h2>
            <p className="min-w-0 font-sans text-[16px] font-medium tabular-nums leading-snug text-foreground sm:text-[17px]">
              {geometry ? (
                <>
                  <span>{geometry}</span>
                  {volume ? (
                    <>
                      <span className="mx-1.5 font-normal text-foreground" aria-hidden>
                        ·
                      </span>
                      <span>{volume}</span>
                    </>
                  ) : null}
                </>
              ) : volume ? (
                <span>{volume}</span>
              ) : showUnparsedStoredFallback ? (
                <span>{stored}</span>
              ) : null}
            </p>
          </div>
        ) : null}

        {hasBrandModel ? (
          <div className="flex w-full flex-col gap-1.5 items-start">
            {!hasDims ? (
              <h2
                id={brandHeadingId}
                className="font-sans text-[12px] font-normal uppercase tracking-wide text-foreground"
              >
                Brand &amp; model
              </h2>
            ) : null}
            <p className="min-w-0 font-sans text-[16px] font-medium leading-snug text-foreground sm:text-[17px]">
              {brand ? (
                linkBrand && brandHref ? (
                  <Link
                    href={brandHref}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {brand}
                  </Link>
                ) : (
                  <span>{brand}</span>
                )
              ) : null}
              {brand && model ? (
                <span className="mx-1.5 font-normal text-foreground" aria-hidden>
                  ·
                </span>
              ) : null}
              {model ? <span>{model}</span> : null}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
