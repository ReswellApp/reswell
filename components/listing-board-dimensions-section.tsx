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
}

/**
 * Renders board dimensions above the description. Uses the listing row from the detail query
 * (same source as `select *`) so we never request columns that may not exist yet in the DB.
 */
export function ListingBoardDimensionsBlock({
  listingId,
  dimensions,
  className,
}: ListingBoardDimensionsBlockProps) {
  const geometry = formatListingGeometryLine(dimensions)
  const volume = formatListingVolumePart(dimensions)
  if (!geometry && !volume) return null

  const headingId = `listing-${listingId}-board-dimensions`

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "rounded-3xl bg-muted/45 px-5 py-4 dark:bg-muted/25",
        className,
      )}
    >
      <div className="flex flex-col gap-1.5 items-start text-left">
        <h2
          id={headingId}
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
          ) : (
            <span>{volume}</span>
          )}
        </p>
      </div>
    </section>
  )
}
