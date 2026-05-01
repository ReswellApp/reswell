import { z } from "zod"

const uuid = z.string().trim().uuid("Expected order UUID")
const seId = z.string().trim().regex(/^se-[a-zA-Z0-9_-]+$/, "Expected ShipEngine id like se-…")

export const shipengineLabelVoidBodySchema = z.object({
  order_id: uuid,
  /** When omitted, resolves the newest non-voided label for this order’s saved tracking number. */
  label_id: seId.optional(),
})

export type ShipengineLabelVoidBody = z.infer<typeof shipengineLabelVoidBodySchema>
