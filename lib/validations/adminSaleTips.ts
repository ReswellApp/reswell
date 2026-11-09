import { z } from "zod"

export const adminSaleTipListQuerySchema = z.object({
  status: z.enum(["all", "pending", "succeeded", "canceled", "failed"]).optional(),
  q: z.string().trim().max(120).optional(),
  seller: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
})

export type AdminSaleTipListQuery = z.infer<typeof adminSaleTipListQuerySchema>
