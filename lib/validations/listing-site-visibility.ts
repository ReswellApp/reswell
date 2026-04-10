import { z } from "zod"

export const listingSiteVisibilityBodySchema = z.object({
  hidden_from_site: z.boolean(),
})
