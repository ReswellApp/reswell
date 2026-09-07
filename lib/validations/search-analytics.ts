import { z } from "zod"

/** Allowed rolling-window sizes (days) for the "window" trend mode. */
export const SEARCH_TREND_WINDOW_DAYS = [7, 14, 30, 90] as const

export const searchTrendPeriodQuerySchema = z
  .object({
    mode: z.enum(["all", "month", "window"]),
    yearMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/, "Must be yyyy-MM")
      .optional(),
    windowDays: z.coerce
      .number()
      .int()
      .refine((n) => (SEARCH_TREND_WINDOW_DAYS as readonly number[]).includes(n), {
        message: "Unsupported window size",
      })
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.mode === "window" && !val.windowDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "windowDays is required when mode is window",
        path: ["windowDays"],
      })
      return
    }
    if (val.mode !== "month") return
    if (!val.yearMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "yearMonth is required when mode is month",
        path: ["yearMonth"],
      })
      return
    }
    const mo = Number(val.yearMonth.slice(5, 7))
    if (!Number.isInteger(mo) || mo < 1 || mo > 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid calendar month",
        path: ["yearMonth"],
      })
    }
  })

export type SearchTrendPeriodQuery = z.infer<typeof searchTrendPeriodQuerySchema>

export const searchQueryLookupSchema = z.object({
  q: z.string().trim().min(1).max(200),
})

export type SearchQueryLookupInput = z.infer<typeof searchQueryLookupSchema>
