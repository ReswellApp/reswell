import { z } from "zod"

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  /** Client origin for building the recovery callback when not inferable server-side. */
  siteOrigin: z.string().trim().url().optional(),
})

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>
