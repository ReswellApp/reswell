import { z } from "zod"

/** Public surfaces an admin can force-revalidate from the Admin tools page. */
export const REVALIDATE_TARGETS = [
  "home",
  "brands",
  "sellers",
  "blog",
  "all",
] as const

export type RevalidateTarget = (typeof REVALIDATE_TARGETS)[number]

export const revalidateRequestSchema = z.object({
  target: z.enum(REVALIDATE_TARGETS),
})

export type RevalidateRequest = z.infer<typeof revalidateRequestSchema>
