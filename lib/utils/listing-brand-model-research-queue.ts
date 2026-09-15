/**
 * PostgREST `or` filter: never researched, or last attempt older than the cutoff.
 * Applied in the query so cooled-down head rows cannot starve later unmatched listings.
 */
export function unmatchedResearchCooldownOrFilter(researchedBefore: string): string {
  return `last_researched_at.is.null,last_researched_at.lt."${researchedBefore}"`
}
