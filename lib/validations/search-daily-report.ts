import { z } from "zod"

export const SEARCH_DAILY_REPORT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const searchDailyReportDateSchema = z
  .string()
  .regex(SEARCH_DAILY_REPORT_DATE_RE, "Must be YYYY-MM-DD")

export const searchDailyReportGenerateSchema = z.object({
  date: searchDailyReportDateSchema.optional(),
  force: z.boolean().optional().default(false),
})

export const searchDailyReportApplySynonymSchema = z.object({
  date: searchDailyReportDateSchema,
  query: z.string().trim().min(1).max(200),
})

export const searchDailyReportQuerySchema = z.object({
  date: searchDailyReportDateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(120).optional().default(90),
})

const likelyCauseValues = [
  "no_inventory",
  "synonym_gap",
  "typo_or_spelling",
  "wrong_category",
  "nl_parse_miss",
  "unknown",
] as const

const priorityValues = ["high", "medium", "low"] as const
const effortValues = ["small", "medium", "large"] as const
const ownerValues = ["inventory", "search", "sellers", "buyers", "ops"] as const

/** Structured Gemini output for the daily search briefing. */
export const searchDailyLlmReportSchema = z.object({
  executiveSummary: z
    .string()
    .describe(
      "3–6 sentence briefing for Reswell operators: what shoppers looked for, where search failed, and the highest-leverage move.",
    ),
  demandThemes: z
    .array(
      z.object({
        theme: z.string().describe("Cluster of related searches (brand, model, size, style, price)."),
        evidence: z.string().describe("Counts / example queries that support the theme."),
        buyerIntent: z.string().describe("What the buyer is trying to find."),
        recommendation: z.string().describe("Concrete merchandising or inventory step."),
      }),
    )
    .max(8),
  emptySearchFixes: z
    .array(
      z.object({
        query: z.string(),
        searchCount: z.number().int().nonnegative(),
        likelyCause: z.enum(likelyCauseValues),
        inventoryAction: z
          .string()
          .describe("How to add or source supply so this query can match listings."),
        searchAction: z
          .string()
          .describe("Synonym, ranking, NL parse, or typeahead change if inventory already exists."),
      }),
    )
    .max(20),
  dropdownInsights: z
    .array(
      z.object({
        finding: z.string(),
        action: z.string(),
      }),
    )
    .max(8),
  inventoryOpportunities: z
    .array(
      z.object({
        item: z.string().describe("Brand, model, size, or category to source."),
        demandSignal: z.string(),
        sellerPlay: z
          .string()
          .describe("How to recruit or prompt sellers (outreach, listing tips, pricing)."),
        priority: z.enum(priorityValues),
      }),
    )
    .max(12),
  searchQuality: z
    .array(
      z.object({
        finding: z.string(),
        action: z.string(),
      }),
    )
    .max(8),
  sellerOpportunities: z
    .array(
      z.object({
        finding: z.string(),
        action: z.string(),
      }),
    )
    .max(8),
  buyerExperience: z
    .array(
      z.object({
        finding: z.string(),
        action: z.string(),
      }),
    )
    .max(8),
  recurringFromPriorDays: z
    .array(
      z.object({
        theme: z.string(),
        daysSeen: z.number().int().positive(),
        nextStep: z.string(),
      }),
    )
    .max(8),
  topActions: z
    .array(
      z.object({
        title: z.string(),
        owner: z.enum(ownerValues),
        why: z.string(),
        effort: z.enum(effortValues),
      }),
    )
    .max(7),
  synonymProposals: z
    .array(
      z.object({
        query: z
          .string()
          .describe("Exact shopper query from the telemetry (e.g. pod mod)."),
        term: z
          .string()
          .describe("Normalized synonym key to match, lowercase (e.g. pod mod)."),
        expansions: z
          .array(z.string().trim().min(1).max(100))
          .min(1)
          .max(8)
          .describe(
            "Canonical catalog names to OR into search, e.g. Channel Islands Pod Mod, podmod.",
          ),
        reason: z.string().describe("Why this mapping recovers the empty search."),
        apply: z
          .boolean()
          .describe(
            "True only when catalogHints shows this is an alias/typo of a brand or model we already sell. False when the board is missing from inventory.",
          ),
        applied: z
          .boolean()
          .optional()
          .describe("Set by the server after writing the synonym. Leave unset."),
        skippedReason: z
          .string()
          .optional()
          .describe("Set by the server when apply was skipped. Leave unset."),
      }),
    )
    .max(20)
    .default([])
    .describe(
      "Structured synonym rules for empty searches that are aliases of catalog boards (pod mod → Channel Islands Pod Mod).",
    ),
})

export type SearchDailyLlmReport = z.infer<typeof searchDailyLlmReportSchema>
export type SearchDailySynonymProposal = SearchDailyLlmReport["synonymProposals"][number]
export type SearchDailyReportGenerateInput = z.infer<typeof searchDailyReportGenerateSchema>
