import { z } from "zod"

export const adminListingCategoryBodySchema = z.object({
  category_id: z.string().uuid(),
})
