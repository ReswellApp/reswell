import { z } from "zod"

export const adminMarketplaceThreadReplyBodySchema = z.object({
  content: z.string().trim().min(1).max(8000),
})

export type AdminMarketplaceThreadReplyBody = z.infer<typeof adminMarketplaceThreadReplyBodySchema>
