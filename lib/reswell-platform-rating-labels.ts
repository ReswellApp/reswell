/** Trustpilot-style qualitative label for an average 0–5 platform rating. */
export function reswellPlatformRatingLabel(avgRating: number): string {
  if (avgRating >= 4.5) return "Excellent"
  if (avgRating >= 4) return "Great"
  if (avgRating >= 3) return "Average"
  if (avgRating >= 2) return "Poor"
  if (avgRating >= 1) return "Bad"
  return "Rate us"
}
