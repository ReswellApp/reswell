import { useColorScheme } from "react-native"

/** Matches `app/globals.css` — light canvas, near-black ink, muted slate. */
export const lightColors = {
  background: "#FFFFFF",
  foreground: "#04070E",
  muted: "#65748B",
  border: "#E2E8F0",
  card: "#FFFFFF",
  /** Subtle fill. Matches globals `--secondary` / `--muted` (210 40% 98%). */
  secondary: "#F8FAFC",
  image: "#F3F4F6",
  primary: "#04070E",
  primaryForeground: "#FFFFFF",
  /** Sell Continue / progress. Same as website `listingHeart`. */
  listingHeart: "#355185",
  /** Seller profile hero when no `banner_url`. Same as `SELLER_PROFILE_BANNER_DEFAULT` in `lib/brand-colors.ts`. */
  sellerProfileBannerDefault: "#5574AD",
  shipping: "#4263EB",
  protection: "#EEF2FF",
  sold: "#163060",
  /** Rating stars. Same as website `lib/rating-star-styles.ts`. */
  reviewStar: "#EBB847",
  destructive: "#DC2626",
}

export const darkColors = {
  background: "#121212",
  foreground: "#FAFAFA",
  muted: "#A6A6A6",
  border: "#333333",
  card: "#1A1A1A",
  /** Matches globals dark `--secondary` (0 0% 17%). */
  secondary: "#2B2B2B",
  image: "#2A2A2A",
  primary: "#FAFAFA",
  primaryForeground: "#04070E",
  /** Sell Continue / progress. Same as website `listingHeart`. */
  listingHeart: "#355185",
  sellerProfileBannerDefault: "#5574AD",
  shipping: "#4263EB",
  protection: "#1B2436",
  sold: "#9BB6F0",
  reviewStar: "#EBB847",
  destructive: "#D4D4D4",
}

export type ReswellColors = typeof lightColors

export const fontFamily = {
  text: "StackSansText",
  headline: "StackSansHeadline",
} as const

export function useReswellColors(): ReswellColors {
  return useColorScheme() === "dark" ? darkColors : lightColors
}
