import { z } from "zod"

export const endListingBodySchema = z.object({
  mode: z.enum(["archive", "delete"]),
})

export type EndListingBody = z.infer<typeof endListingBodySchema>
