import { z } from "zod"

export const supportCaseSellerOutreachSchema = z.object({
  source_case_id: z.string().uuid(),
  message: z.string().trim().min(10).max(8000),
})
