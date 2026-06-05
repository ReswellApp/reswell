import { cn } from "@/lib/utils"

/** Shared horizontal rhythm for `/sellers/[slug]` — matches homepage `container mx-auto` (max 1400px). */
export const sellerProfileShellClassName = cn("container mx-auto w-full min-w-0 px-4 sm:px-6")

/** Full-bleed shop banner — Reverb-style edge-to-edge header. */
export const sellerProfileBannerClassName = cn(
  "relative w-full overflow-hidden bg-[#04070E]",
  "min-h-[100px] sm:min-h-[120px] md:min-h-[140px] lg:min-h-[160px]",
)

/** Listing grid — 2-up on mobile, denser as viewport grows. */
export const sellerProfileListingsGridClassName = cn(
  "grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3",
  "lg:grid-cols-4 lg:gap-4 xl:grid-cols-5 2xl:grid-cols-6",
)

/** Listing list — stacked horizontal rows. */
export const sellerProfileListingsListClassName = "flex min-w-0 flex-col gap-2 sm:gap-2.5"

export const sellerProfileBannerImageSizes =
  "(max-width: 640px) 100vw, (max-width: 1024px) 92vw, 1400px"
