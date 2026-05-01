import { z } from "zod"

const seId = z.string().trim().regex(/^se-[a-zA-Z0-9_-]+$/, "Expected ShipEngine id like se-…")

export const shipengineLabelSendBodySchema = z
  .object({
    order_id: z.string().uuid().optional(),
    shipment_id: seId.optional(),
    label_id: seId.optional(),
  })
  .refine((q) => q.shipment_id || q.label_id, {
    message: "Provide shipment_id or label_id",
  })
  .refine((q) => !(q.shipment_id && q.label_id), {
    message: "Pass only one of shipment_id or label_id",
  })

export type ShipengineLabelSendBody = z.infer<typeof shipengineLabelSendBodySchema>
