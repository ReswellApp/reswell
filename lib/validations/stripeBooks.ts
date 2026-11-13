import { z } from "zod"

export const stripeBooksRangeSchema = z.enum(["all", "30d", "90d", "ytd"])

export const stripeBooksMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)

export const stripeBooksQuerySchema = z.object({
  range: stripeBooksRangeSchema.optional(),
  month: stripeBooksMonthSchema.optional(),
  format: z.enum(["json", "csv"]).optional(),
})

export type StripeBooksQuery = z.infer<typeof stripeBooksQuerySchema>
