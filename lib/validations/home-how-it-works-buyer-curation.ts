import { z } from "zod"

export const howItWorksBuyerBoardTypeSchema = z.enum(["shortboard", "hybrid", "longboard"])

export const adminHowItWorksBuyerBodySchema = z.object({
  board_type: howItWorksBuyerBoardTypeSchema,
  listing_id: z.string().trim().uuid("listing_id must be a UUID"),
})

export const adminHowItWorksBuyerDeleteQuerySchema = z.object({
  board_type: howItWorksBuyerBoardTypeSchema,
})

export const adminHowItWorksBuyerSearchQuerySchema = z.object({
  board_type: howItWorksBuyerBoardTypeSchema,
  q: z.string().trim().max(120).optional().default(""),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return 20
      const n = typeof v === "number" ? v : Number(v)
      if (!Number.isFinite(n)) return 20
      return Math.min(Math.max(Math.trunc(n), 1), 50)
    }),
})
