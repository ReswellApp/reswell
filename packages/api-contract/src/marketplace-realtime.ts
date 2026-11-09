import { z } from "zod"

/** Private Realtime topic for one open marketplace thread. */
export function marketplaceThreadChannel(conversationId: string): string {
  return `marketplace-thread:${conversationId}`
}

/** Private Realtime topic for one person's inbox badge and conversation list. */
export function marketplaceInboxChannel(userId: string): string {
  return `marketplace-inbox:${userId}`
}

export const MARKETPLACE_THREAD_MESSAGE_EVENT = "message"
export const MARKETPLACE_THREAD_REFRESH_EVENT = "refresh"

export const marketplaceThreadBroadcastMessageSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  content: z.string(),
  created_at: z.string().min(1),
  is_read: z.boolean().nullable().optional(),
  offer_id: z.string().uuid().nullable().optional(),
  metadata: z.unknown().optional(),
})

export type MarketplaceThreadBroadcastMessage = z.infer<
  typeof marketplaceThreadBroadcastMessageSchema
>

export const marketplaceThreadRefreshSchema = z.object({
  conversation_id: z.string().uuid(),
})
