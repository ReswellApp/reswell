import type { ReswellPlatformReviewRow } from "@/lib/db/reswellPlatformReviews"

export type ReswellPlatformStarDistribution = {
  stars: 1 | 2 | 3 | 4 | 5
  count: number
  percent: number
}

const STAR_LEVELS = [5, 4, 3, 2, 1] as const

export function computeReswellPlatformStarDistribution(
  reviews: Pick<ReswellPlatformReviewRow, "rating">[],
): ReswellPlatformStarDistribution[] {
  const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

  for (const review of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5
    counts[star] += 1
  }

  const total = reviews.length

  return STAR_LEVELS.map((stars) => ({
    stars,
    count: counts[stars],
    percent: total === 0 ? 0 : Math.round((counts[stars] / total) * 100),
  }))
}

export function formatReswellReviewCount(count: number): string {
  if (count >= 1000) {
    const thousands = count / 1000
    return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1).replace(/\.0$/, "")}K`
  }

  return count.toLocaleString("en-US")
}

export function initialsFromFullName(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function truncateReviewText(
  text: string,
  maxLength = 160,
): { text: string; truncated: boolean } {
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) {
    return { text: trimmed, truncated: false }
  }

  return { text: `${trimmed.slice(0, maxLength).trimEnd()}…`, truncated: true }
}

export const RESWELL_REVIEW_MENTION_TAGS = [
  "Buying",
  "Selling",
  "Shipping",
  "Pickup",
  "Customer service",
  "Offers",
] as const
