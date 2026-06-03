import { cn } from "@/lib/utils"

/** Shared horizontal rhythm for `/sellers/[slug]` — matches homepage `container mx-auto` (max 1400px). */
export const sellerProfileShellClassName = cn("container mx-auto w-full min-w-0")

/** Profile header banner — minimum height scales up on larger viewports. */
export const sellerProfileBannerClassName = cn(
  "relative overflow-hidden rounded-xl sm:rounded-2xl",
  "min-h-[168px] sm:min-h-[192px] lg:min-h-[220px]",
)

/** Listing grid — 2-up on mobile, denser as viewport grows. */
export const sellerProfileListingsGridClassName = cn(
  "grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3",
  "lg:grid-cols-4 lg:gap-4 xl:grid-cols-5 2xl:grid-cols-6",
)

export const sellerProfileBannerImageSizes =
  "(max-width: 640px) 100vw, (max-width: 1024px) 92vw, 1400px"
