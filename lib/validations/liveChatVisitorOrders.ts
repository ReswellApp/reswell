import { z } from "zod"

export const liveChatVisitorOrdersQuerySchema = z.object({
  visitor_token: z.string().uuid().optional(),
})
