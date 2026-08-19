import { z } from "zod"

export const SELLER_PRINT_SHIPPING_LABELS_MAX = 25

export const sellerPrintShippingLabelIdsSchema = z
  .array(z.string().trim().uuid())
  .min(1, "Select at least one shipping label")
  .max(
    SELLER_PRINT_SHIPPING_LABELS_MAX,
    `You can print up to ${SELLER_PRINT_SHIPPING_LABELS_MAX} labels at a time`,
  )

export const sellerPrintShippingLabelsQuerySchema = z.object({
  ids: z
    .string()
    .trim()
    .min(1)
    .transform((raw) => raw.split(",").map((id) => id.trim()).filter(Boolean))
    .pipe(sellerPrintShippingLabelIdsSchema),
})
