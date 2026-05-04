import { z } from "zod"

export const searchTrendPeriodQuerySchema = z
  .object({
    mode: z.enum(["all", "month"]),
    yearMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/, "Must be yyyy-MM")
      .optional(),
  })
  .superRefine((val, ctx) => {
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
