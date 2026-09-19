import { z } from "zod"

export const cityLandingResolveQuerySchema = z.object({
  label: z.string().trim().min(1).max(200),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(40).optional(),
})

export type CityLandingResolveQuery = z.infer<typeof cityLandingResolveQuerySchema>
