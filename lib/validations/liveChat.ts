import { z } from "zod"

export const liveChatSessionStatusSchema = z.enum(["open", "assigned", "resolved", "closed"])
export type LiveChatSessionStatus = z.infer<typeof liveChatSessionStatusSchema>

export const liveChatSenderTypeSchema = z.enum(["visitor", "agent", "system"])
export type LiveChatSenderType = z.infer<typeof liveChatSenderTypeSchema>

export const createLiveChatSessionSchema = z.object({
  visitor_token: z.string().uuid(),
  visitor_name: z.string().trim().min(1).max(80).optional(),
  resume_public_id: z.string().trim().min(8).max(64).optional(),
})

export const sendLiveChatVisitorMessageSchema = z.object({
  visitor_token: z.string().uuid(),
  content: z.string().trim().min(1).max(10000),
  visitor_name: z.string().trim().min(1).max(80).optional(),
  visitor_email: z.string().trim().email().optional(),
})

export const sendLiveChatAgentMessageSchema = z.object({
  session_id: z.string().uuid(),
  content: z.string().trim().min(1).max(10000),
})

export const updateLiveChatSessionAdminSchema = z.object({
  session_id: z.string().uuid(),
  status: liveChatSessionStatusSchema.optional(),
  assigned_agent_id: z.string().uuid().nullable().optional(),
})

export const escalateLiveChatSessionSchema = z.object({
  session_id: z.string().uuid(),
})

export const liveChatTypingSchema = z.object({
  visitor_token: z.string().uuid().optional(),
  participant_type: z.enum(["visitor", "agent"]),
  display_name: z.string().trim().min(1).max(80),
  is_typing: z.boolean(),
})
