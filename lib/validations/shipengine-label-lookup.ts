import { z } from "zod"

/** ShipEngine IDs: se-… */
const seId = z.string().trim().regex(/^se-[a-zA-Z0-9_-]+$/, "Expected ShipEngine id (e.g. se-123…).")

export const shipengineLabelLookupQuerySchema = z
  .object({
    shipment_id: seId.optional(),
    label_id: seId.optional(),
  })
  .refine((q) => q.shipment_id || q.label_id, {
    message: "Provide shipment_id or label_id",
  })
  .refine((q) => !(q.shipment_id && q.label_id), {
    message: "Pass only one of shipment_id or label_id",
  })

export type ShipengineLabelLookupQuery = z.infer<typeof shipengineLabelLookupQuerySchema>
