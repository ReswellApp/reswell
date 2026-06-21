import type { ReactNode } from "react"
import { AboutHeroBoardStack } from "@/components/features/marketing/about-hero-board-stack"
import { cn } from "@/lib/utils"

export const marketingHeadlineTitleClass =
  "font-headline text-[clamp(1.75rem,4vw,2.75rem)] font-bold uppercase leading-[1.05] tracking-tight text-foreground"

type MarketingHeadlineHeroProps = {
  headline: ReactNode
  heroListingImages: readonly string[]
  className?: string
  bordered?: boolean
  listingImagesOnly?: boolean
  /** Less top padding — e.g. when stacked directly under the reviews marquee. */
  compactTop?: boolean
  /** Compress layout on mobile so the hero fits above-the-fold with reviews + CTA. */
  mobileOneScreen?: boolean
  /** White canvas — no muted card fill (e.g. /listyoursurfboard). */
  plainSurface?: boolean
}

export function MarketingHeadlineHero({
  headline,
  heroListingImages,
  className,
  bordered = true,
  listingImagesOnly = false,
  compactTop = false,
  mobileOneScreen = false,
  plainSurface = false,
}: MarketingHeadlineHeroProps) {
  return (
    <section
      data-lys-hero={mobileOneScreen ? true : undefined}
      className={cn(
        bordered && "border-b border-border/70 bg-background",
        mobileOneScreen && "max-lg:min-h-0 max-lg:flex-1 max-lg:flex-col",
        className,
      )}
    >
      <div
        className={cn(
          "container mx-auto px-4 sm:px-6",
          compactTop
            ? "pb-8 pt-3 sm:pb-10 sm:pt-4 lg:pb-12"
            : "py-10 sm:py-12 lg:py-14",
          mobileOneScreen &&
            "max-lg:flex max-lg:min-h-0 max-lg:flex-1 max-lg:flex-col max-lg:px-3 max-lg:pb-0 max-lg:pt-0",
        )}
      >
        <div
          data-lys-hero-card={mobileOneScreen ? true : undefined}
          className={cn(
            "overflow-hidden rounded-[2rem] px-6 sm:px-10 lg:px-14",
            plainSurface ? "bg-background" : "bg-muted/70",
            compactTop ? "py-8 sm:py-10 lg:py-12" : "py-10 sm:py-12 lg:py-16",
            mobileOneScreen &&
              "max-lg:flex max-lg:min-h-0 max-lg:flex-1 max-lg:flex-col max-lg:rounded-2xl max-lg:px-0 max-lg:py-0 sm:px-10",
          )}
        >
          <div
            data-lys-hero-grid={mobileOneScreen ? true : undefined}
            className={cn(
              "grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12",
              mobileOneScreen && "max-lg:min-h-0 max-lg:flex-1 lg:gap-12",
            )}
          >
            <div
              data-lys-hero-copy={mobileOneScreen ? true : undefined}
              className={cn(mobileOneScreen && "max-lg:min-w-0")}
            >
              {headline}
            </div>
            <div
              data-lys-hero-media={mobileOneScreen ? true : undefined}
              className={cn(mobileOneScreen && "max-lg:min-h-0 max-lg:min-w-0")}
            >
              <AboutHeroBoardStack
                images={heroListingImages}
                listingImagesOnly={listingImagesOnly}
                compactMobile={mobileOneScreen}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
