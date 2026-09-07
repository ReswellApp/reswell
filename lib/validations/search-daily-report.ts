import { z } from "zod"

export const SEARCH_DAILY_REPORT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const searchDailyReportDateSchema = z
  .string()
  .regex(SEARCH_DAILY_REPORT_DATE_RE, "Must be YYYY-MM-DD")

export const searchDailyReportGenerateSchema = z.object({
  date: searchDailyReportDateSchema.optional(),
  force: z.boolean().optional().default(false),
})

export const SEARCH_PERIOD_KIND_VALUES = ["month", "all_time"] as const
export const SEARCH_PERIOD_MONTH_RE = /^\d{4}-\d{2}$/
export const SEARCH_PERIOD_ALL_TIME_KEY = "all"

export const searchPeriodKindSchema = z.enum(SEARCH_PERIOD_KIND_VALUES)
export const searchPeriodMonthKeySchema = z
  .string()
  .regex(SEARCH_PERIOD_MONTH_RE, "Must be YYYY-MM")

export const searchDailyReportApplySynonymSchema = z
  .object({
    date: searchDailyReportDateSchema.optional(),
    periodKind: searchPeriodKindSchema.optional(),
    periodKey: z.string().trim().min(1).max(32).optional(),
    query: z.string().trim().min(1).max(200),
  })
  .superRefine((value, ctx) => {
    if (value.date) return
    if (value.periodKind && value.periodKey) {
      if (value.periodKind === "month" && !SEARCH_PERIOD_MONTH_RE.test(value.periodKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Monthly periodKey must be YYYY-MM",
          path: ["periodKey"],
        })
      }
      if (value.periodKind === "all_time" && value.periodKey !== SEARCH_PERIOD_ALL_TIME_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'All-time periodKey must be "all"',
          path: ["periodKey"],
        })
      }
      return
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide a daily date or a periodKind and periodKey",
      path: ["date"],
    })
  })

export const searchPeriodReportQuerySchema = z.object({
  kind: searchPeriodKindSchema.optional().default("month"),
  key: z.string().trim().min(1).max(32).optional(),
  limit: z.coerce.number().int().min(1).max(36).optional().default(24),
})

export const searchPeriodReportGenerateSchema = z
  .object({
    kind: searchPeriodKindSchema,
    key: z.string().trim().min(1).max(32).optional(),
    force: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.key) return
    if (value.kind === "month") {
      const month = searchPeriodMonthKeySchema.safeParse(value.key)
      if (!month.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Monthly key must be YYYY-MM",
          path: ["key"],
        })
      }
    }
    if (value.kind === "all_time" && value.key !== SEARCH_PERIOD_ALL_TIME_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'All-time key must be "all"',
        path: ["key"],
      })
    }
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

const demandListItemSchema = z.object({
  item: z.string().describe("Brand, model, size, or category shoppers searched for most."),
  searchCount: z.number().int().nonnegative(),
  emptyCount: z.number().int().nonnegative(),
  inventoryGap: z
    .boolean()
    .describe("True when this demand is mostly unmet (empty results or missing listings)."),
  demandSignal: z.string().describe("Why this ranks: counts, empty share, notify-me, dropdown picks."),
  sellerPlay: z.string().describe("How to recruit or prompt sellers to list this item."),
  priority: z.enum(priorityValues),
})

const emptySearchFixSchema = z.object({
  query: z.string(),
  searchCount: z.number().int().nonnegative(),
  likelyCause: z.enum(likelyCauseValues),
  inventoryAction: z
    .string()
    .describe("How to add or source supply so this query can match listings."),
  searchAction: z
    .string()
    .describe("Synonym, ranking, NL parse, or typeahead change if inventory already exists."),
})

const findingActionSchema = z.object({
  finding: z.string(),
  action: z.string(),
})

const inventoryOpportunitySchema = z.object({
  item: z.string().describe("Brand, model, size, or category to source."),
  demandSignal: z.string(),
  sellerPlay: z
    .string()
    .describe("How to recruit or prompt sellers (outreach, listing tips, pricing)."),
  priority: z.enum(priorityValues),
})

const demandThemeSchema = z.object({
  theme: z.string().describe("Cluster of related searches (brand, model, size, style, price)."),
  evidence: z.string().describe("Counts / example queries that support the theme."),
  buyerIntent: z.string().describe("What the buyer is trying to find."),
  recommendation: z.string().describe("Concrete merchandising or inventory step."),
})

const synonymProposalSchema = z.object({
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
})

/** Structured Gemini output for the daily search briefing. */
export const searchDailyLlmReportSchema = z.object({
  executiveSummary: z
    .string()
    .describe(
      "3–6 sentence briefing for Reswell operators: what shoppers looked for, where search failed, and the highest-leverage move.",
    ),
  demandThemes: z.array(demandThemeSchema).max(8),
  emptySearchFixes: z.array(emptySearchFixSchema).max(20),
  dropdownInsights: z.array(findingActionSchema).max(8),
  inventoryOpportunities: z.array(inventoryOpportunitySchema).max(12),
  searchQuality: z.array(findingActionSchema).max(8),
  sellerOpportunities: z.array(findingActionSchema).max(8),
  buyerExperience: z.array(findingActionSchema).max(8),
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
    .array(synonymProposalSchema)
    .max(20)
    .default([])
    .describe(
      "Structured synonym rules for empty searches that are aliases of catalog boards (pod mod → Channel Islands Pod Mod).",
    ),
  demandList: z
    .array(demandListItemSchema)
    .max(12)
    .default([])
    .describe("Ranked demand list of the most-searched items to source or merchandize."),
})

/** Broader Gemini output for monthly and all-time search briefings. */
export const searchPeriodLlmReportSchema = searchDailyLlmReportSchema
  .omit({
    demandThemes: true,
    emptySearchFixes: true,
    dropdownInsights: true,
    inventoryOpportunities: true,
    searchQuality: true,
    sellerOpportunities: true,
    buyerExperience: true,
    recurringFromPriorDays: true,
    topActions: true,
    synonymProposals: true,
    demandList: true,
  })
  .extend({
    demandThemes: z.array(demandThemeSchema).max(16),
    emptySearchFixes: z.array(emptySearchFixSchema).max(40),
    dropdownInsights: z.array(findingActionSchema).max(12),
    inventoryOpportunities: z.array(inventoryOpportunitySchema).max(24),
    searchQuality: z.array(findingActionSchema).max(12),
    sellerOpportunities: z.array(findingActionSchema).max(12),
    buyerExperience: z.array(findingActionSchema).max(12),
    recurringFromPriorDays: z
      .array(
        z.object({
          theme: z.string(),
          daysSeen: z.number().int().positive(),
          nextStep: z.string(),
        }),
      )
      .max(12),
    topActions: z
      .array(
        z.object({
          title: z.string(),
          owner: z.enum(ownerValues),
          why: z.string(),
          effort: z.enum(effortValues),
        }),
      )
      .max(10),
    synonymProposals: z.array(synonymProposalSchema).max(30).default([]),
    demandList: z
      .array(demandListItemSchema)
      .max(40)
      .default([])
      .describe(
        "Ranked demand list of the most-searched items across this period. Lead with highest search volume.",
      ),
  })

export type SearchDailyLlmReport = z.infer<typeof searchDailyLlmReportSchema>
export type SearchPeriodLlmReport = z.infer<typeof searchPeriodLlmReportSchema>
export type SearchDemandListItem = z.infer<typeof demandListItemSchema>
export type SearchDailySynonymProposal = SearchDailyLlmReport["synonymProposals"][number]
export type SearchDailyReportGenerateInput = z.infer<typeof searchDailyReportGenerateSchema>
export type SearchPeriodReportGenerateInput = z.infer<typeof searchPeriodReportGenerateSchema>
