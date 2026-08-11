import { z } from "zod"

export const liveChatAiIntentSchema = z.enum([
  /** Activate AI mode and optionally send the first visitor question. */
  "activate",
  /** Persist visitor message + generate AI reply (AI mode). */
  "chat",
  /** Generate AI assist after a human-queue message while agents are offline. */
  "offline_assist",
  /** Visitor explicitly requests a human. */
  "handoff",
])

export type LiveChatAiIntent = z.infer<typeof liveChatAiIntentSchema>

export const liveChatAiRequestSchema = z.object({
  visitor_token: z.string().uuid(),
  intent: liveChatAiIntentSchema,
  content: z.string().trim().min(1).max(10000).optional(),
  /** Client-reported agent presence for hybrid offline assist. */
  agents_online: z.boolean().optional(),
})

export type LiveChatAiRequest = z.infer<typeof liveChatAiRequestSchema>
