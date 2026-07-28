import { z } from "zod"

/** Empty body — label is purchased from the product package dims via ShipEngine. */
export const reswellShopOrderFulfillBodySchema = z.object({}).passthrough()

export type ReswellShopOrderFulfillBody = z.infer<typeof reswellShopOrderFulfillBodySchema>

export const adminReswellShopOrdersQuerySchema = z.object({
  status: z.enum(["all", "confirmed", "refunding", "refunded", "pending"]).optional().default("all"),
  fulfillment: z
    .enum(["all", "awaiting_shipment", "shipped", "delivered"])
    .optional()
    .default("awaiting_shipment"),
  q: z.string().optional(),
  sort: z.enum(["created_at", "amount"]).optional().default("created_at"),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

export type AdminReswellShopOrdersQuery = z.infer<typeof adminReswellShopOrdersQuerySchema>
