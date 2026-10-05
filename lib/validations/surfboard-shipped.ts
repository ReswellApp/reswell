import { z } from "zod"

import { toE164UsPhone } from "@/lib/utils/phone-e164-us"
import { isCaliforniaAddressState } from "@/lib/services/surfboardShipped"

const pickupAddressSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(40)
    .refine((value) => toE164UsPhone(value) != null, "Enter a US phone number."),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(1).max(120),
  state: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .refine((value) => isCaliforniaAddressState(value), "Pickup must be in California."),
  postal_code: z.string().trim().min(5).max(32),
  country: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .default("US")
    .refine((value) => {
      const country = value.toUpperCase()
      return country === "US" || country === "USA" || country === "UNITED STATES"
    }, "Pickup must be in the United States."),
})

export const saveListingSurfboardShippedSchema = z
  .object({
    listingId: z.string().uuid(),
    enabled: z.boolean(),
    addressId: z.string().uuid().nullable().optional(),
    address: pickupAddressSchema.optional(),
  })
  .refine((data) => !data.enabled || data.address != null, {
    message: "Add a California pickup name, phone, and address.",
    path: ["address"],
  })

export type SaveListingSurfboardShippedInput = z.infer<typeof saveListingSurfboardShippedSchema>

export const previewSurfboardShippedCheckoutSchema = z.object({
  listingId: z.string().uuid(),
  addressId: z.string().uuid(),
})

export type PreviewSurfboardShippedCheckoutInput = z.infer<
  typeof previewSurfboardShippedCheckoutSchema
>
