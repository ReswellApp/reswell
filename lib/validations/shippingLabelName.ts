import { z } from "zod"

/** Carrier label line. Matches the ship-from name cap in sellerShipFromLabel. */
export const SHIPPING_LABEL_NAME_MAX = 80

export const shippingLabelNameInputSchema = z.object({
  shipping_label_name: z
    .string()
    .trim()
    .max(SHIPPING_LABEL_NAME_MAX, `Use ${SHIPPING_LABEL_NAME_MAX} characters or fewer.`)
    .nullable()
    .optional(),
})

export type ShippingLabelNameInput = z.infer<typeof shippingLabelNameInputSchema>
