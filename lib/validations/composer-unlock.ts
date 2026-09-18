import { z } from "zod"

export const composerUnlockTokenSchema = z.string().trim().min(16).max(4000)

export const composerUnlockRequestSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("marketplace"),
  }),
  z.object({
    scope: z.literal("live-chat"),
    visitor_token: z.string().uuid(),
    public_id: z.string().trim().min(8).max(64).optional(),
  }),
])

export type ComposerUnlockRequest = z.infer<typeof composerUnlockRequestSchema>
