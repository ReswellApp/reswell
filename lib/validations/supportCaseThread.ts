import { z } from "zod"

export const supportCaseReplySchema = z.object({
  case_id: z.string().uuid(),
  content: z.string().trim().min(1).max(12000),
})
