import { z } from "zod"

export const adminCohortsQuerySchema = z.object({
  cohortMonths: z.coerce.number().int().min(1).max(36).optional().default(12),
  horizonMonths: z.coerce.number().int().min(2).max(12).optional().default(6),
})

export type AdminCohortsQuery = z.infer<typeof adminCohortsQuerySchema>
