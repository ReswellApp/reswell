import {
  BRAND_CTA_BLUE,
  BRAND_DARK_BLUE,
  BRAND_DEEP_BLUE,
  BRAND_LIGHT_BLUE,
  BRAND_NAVY,
  BRAND_OFF_WHITE,
} from "@/lib/brand-colors"

export type BlogTagAccent = {
  pill: string
  stripe: string
  banner: string
  /** Overlapping board marks on empty banners. */
  marks: string
  heading: string
  /** Hex stops for generated title-card / OG art (Satori cannot use Tailwind). */
  ogFrom: string
  ogTo: string
}

/**
 * Visual accents for blog cards and article heroes.
 * Colors are Reswell brand palette only (`lib/brand-colors.ts`).
 */
export function blogTagAccents(tag: string): BlogTagAccent {
  const key = tag.toLowerCase()
  if (key === "gear") {
    return {
      pill: "border-[#7F9DD5]/50 bg-[#7F9DD5]/20 text-[#163060]",
      stripe: "from-[#7F9DD5] to-[#5574AD]",
      banner: "bg-[#7F9DD5]",
      marks: "bg-[#163060]/15",
      heading: "text-[#163060]",
      ogFrom: BRAND_LIGHT_BLUE,
      ogTo: BRAND_CTA_BLUE,
    }
  }
  if (key === "boards") {
    return {
      pill: "border-[#5574AD]/40 bg-[#5574AD]/15 text-[#163060]",
      stripe: "from-[#5574AD] to-[#355185]",
      banner: "bg-[#5574AD]",
      marks: "bg-white/25",
      heading: "text-[#5574AD]",
      ogFrom: BRAND_CTA_BLUE,
      ogTo: BRAND_DARK_BLUE,
    }
  }
  if (key === "people") {
    return {
      pill: "border-[#355185]/40 bg-[#355185]/15 text-[#163060]",
      stripe: "from-[#355185] to-[#163060]",
      banner: "bg-[#355185]",
      marks: "bg-white/25",
      heading: "text-[#355185]",
      ogFrom: BRAND_DARK_BLUE,
      ogTo: BRAND_DEEP_BLUE,
    }
  }
  if (key === "culture") {
    return {
      pill: "border-[#163060]/30 bg-[#163060]/10 text-[#163060]",
      stripe: "from-[#163060] to-[#001A4A]",
      banner: "bg-[#163060]",
      marks: "bg-white/20",
      heading: "text-[#163060]",
      ogFrom: BRAND_DEEP_BLUE,
      ogTo: BRAND_NAVY,
    }
  }
  if (key === "travel") {
    return {
      pill: "border-[#001A4A]/30 bg-[#001A4A]/10 text-[#163060]",
      stripe: "from-[#001A4A] to-[#04070E]",
      banner: "bg-[#001A4A]",
      marks: "bg-white/20",
      heading: "text-[#5574AD]",
      ogFrom: BRAND_NAVY,
      ogTo: BRAND_DEEP_BLUE,
    }
  }
  return {
    pill: "border-[#7F9DD5]/40 bg-[#F9F9F2] text-[#163060]",
    stripe: "from-[#7F9DD5] to-[#5574AD]",
    banner: "bg-[#F9F9F2]",
    marks: "bg-[#163060]/10",
    heading: "text-[#163060]",
    ogFrom: BRAND_OFF_WHITE,
    ogTo: BRAND_LIGHT_BLUE,
  }
}
