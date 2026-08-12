import { z } from "zod"

export const BUSINESS_INTELLIGENCE_PERIOD_KINDS = ["daily", "weekly", "monthly"] as const
export const BUSINESS_INTELLIGENCE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const BUSINESS_INTELLIGENCE_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
export const BUSINESS_INTELLIGENCE_WEEK_RE = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/

export const businessIntelligencePeriodKindSchema = z.enum(BUSINESS_INTELLIGENCE_PERIOD_KINDS)

export const businessIntelligencePeriodKeySchema = z
  .string()
  .min(7)
  .max(16)
  .regex(
    /^(\d{4}-\d{2}-\d{2}|\d{4}-W(0[1-9]|[1-4]\d|5[0-3])|\d{4}-(0[1-9]|1[0-2]))$/,
    "Must be YYYY-MM-DD, YYYY-Www, or YYYY-MM",
  )

export const businessIntelligenceGenerateSchema = z.object({
  kind: businessIntelligencePeriodKindSchema,
  periodKey: businessIntelligencePeriodKeySchema.optional(),
  force: z.boolean().optional().default(false),
})

export const businessIntelligenceQuerySchema = z.object({
  kind: businessIntelligencePeriodKindSchema.optional(),
  periodKey: businessIntelligencePeriodKeySchema.optional(),
  limit: z.coerce.number().int().min(1).max(90).optional().default(40),
})

const ownerValues = [
  "growth",
  "marketplace",
  "search",
  "ops",
  "ads",
  "product",
  "sellers",
] as const

const effortValues = ["small", "medium", "large"] as const
const impactValues = ["high", "medium", "low"] as const
const toneValues = ["up", "down", "flat", "watch"] as const
const confidenceValues = ["low", "medium", "high"] as const

const projectionWindowSchema = z.object({
  gmv: z.string().describe("Projected GMV as a short labeled range, e.g. $11k–$14k."),
  orders: z.string(),
  users: z.string(),
  rationale: z.string().describe("Why this range, grounded in run-rate and MoM."),
})

/** Structured Gemini output for a Reswell operating briefing. */
export const businessIntelligenceLlmReportSchema = z.object({
  executiveSummary: z
    .string()
    .describe(
      "4–8 sentence briefing for Reswell operators: what the business did, what changed vs the prior period, and the highest-leverage move.",
    ),
  periodRecap: z
    .string()
    .describe("What happened in this period across users, listings, orders, GMV, and traffic."),
  kpiCommentary: z
    .array(
      z.object({
        metric: z.string(),
        takeaway: z.string(),
        tone: z.enum(toneValues),
      }),
    )
    .max(8),
  projections: z.object({
    next7Days: projectionWindowSchema,
    next30Days: projectionWindowSchema,
    next90Days: projectionWindowSchema,
    confidence: z.enum(confidenceValues),
    caveats: z.string(),
  }),
  recommendations: z
    .array(
      z.object({
        title: z.string(),
        why: z.string(),
        action: z.string().describe("Concrete next step Reswell can take this week."),
        owner: z.enum(ownerValues),
        effort: z.enum(effortValues),
        impact: z.enum(impactValues),
      }),
    )
    .max(8),
  risks: z
    .array(
      z.object({
        risk: z.string(),
        signal: z.string(),
        mitigation: z.string(),
      }),
    )
    .max(6),
  opportunities: z
    .array(
      z.object({
        opportunity: z.string(),
        evidence: z.string(),
        nextStep: z.string(),
      }),
    )
    .max(6),
  watchNextPeriod: z.array(z.string()).max(6),
})

export type BusinessIntelligencePeriodKind = z.infer<typeof businessIntelligencePeriodKindSchema>
export type BusinessIntelligenceLlmReport = z.infer<typeof businessIntelligenceLlmReportSchema>
export type BusinessIntelligenceGenerateInput = z.infer<typeof businessIntelligenceGenerateSchema>
