/** Curated surfpack/bag brands shown in the /backpacks filter (plus any brands from live listings). */
export const SURFPACKS_BAGS_CURATED_BRANDS = ["Channel Islands", "Colby Plus"] as const

export function surfpacksBagsBrandOptions(distinctFromListings: string[]): string[] {
  const set = new Set<string>()
  for (const b of SURFPACKS_BAGS_CURATED_BRANDS) set.add(b)
  for (const b of distinctFromListings) {
    const t = b?.trim()
    if (t) set.add(t)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function normalizeSurfpacksBagBrandParam(
  value: string | undefined,
  allowedBrands: string[],
): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return allowedBrands.includes(v) ? v : "all"
}
