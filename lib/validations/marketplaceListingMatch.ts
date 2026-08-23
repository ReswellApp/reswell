import { z } from "zod"

/**
 * Gemini ranking of Elasticsearch title+catalog candidates.
 * Ids must be copied from the provided candidate list — never invented.
 */
export const marketplaceListingMatchSchema = z.object({
  rankedIds: z
    .array(z.string().uuid())
    .max(40)
    .describe("Candidate listing ids that match the query, best first"),
  dropIds: z
    .array(z.string().uuid())
    .max(40)
    .describe("Candidate listing ids that do not match the query"),
  extraPhrases: z
    .array(z.string().max(80))
    .max(6)
    .describe(
      "Alternate title/search phrases that could find more matching listings (nicknames, model variants). Empty if the candidates already cover the query.",
    ),
  summary: z.string().describe("Short reason for the ranking"),
})

export type MarketplaceListingMatch = z.infer<typeof marketplaceListingMatchSchema>
