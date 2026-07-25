/** Badge counts keyed by admin nav href. Safe for client components. */
export type AdminNavBadgeCounts = Record<string, number>

export function sumAdminNavBadgeCounts(
  counts: AdminNavBadgeCounts,
  hrefs: string[],
): number {
  return hrefs.reduce((sum, href) => sum + (counts[href] ?? 0), 0)
}
