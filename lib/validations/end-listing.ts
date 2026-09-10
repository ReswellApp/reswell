import { z } from "zod"

export const endListingBodySchema = z.object({
  mode: z.literal("delete").optional(),
})

export type EndListingBody = z.infer<typeof endListingBodySchema>
