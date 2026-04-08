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
        "rounded-lg border border-border/60 bg-muted/35 px-3 py-2.5 shadow-sm ring-1 ring-inset ring-black/[0.03] dark:bg-muted/25 dark:ring-white/[0.05]",
        className,
      )}
    >
      <div className="flex flex-col gap-1.5 min-[400px]:flex-row min-[400px]:items-baseline min-[400px]:justify-between min-[400px]:gap-3">
        <h2
          id={headingId}
          className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Board dimensions
        </h2>
        <p className="min-w-0 text-[15px] font-semibold tabular-nums leading-snug tracking-tight text-foreground sm:text-base">
          {geometry ? (
            <>
              <span>{geometry}</span>
              {volume ? (
                <>
                  <span className="mx-1.5 font-normal text-muted-foreground" aria-hidden>
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
