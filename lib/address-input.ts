import { z } from "zod"

/** Shipping location only — name and phone come from private profile personal info. */
export const shippingAddressFormSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().max(120).optional().nullable(),
  postal_code: z.string().trim().min(1).max(32),
  country: z.string().trim().min(2).max(64).default("US"),
  label: z.string().trim().max(80).optional().nullable(),
  is_default: z.boolean().optional(),
})

export type ShippingAddressFormInput = z.infer<typeof shippingAddressFormSchema>

/** Body for creating or updating a saved address (buyer, seller, or profile). */
export const profileAddressInputSchema = shippingAddressFormSchema.extend({
  full_name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
})

export type ProfileAddressInput = z.infer<typeof profileAddressInputSchema>

export const profileAddressPatchSchema = profileAddressInputSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" },
)

export type ProfileAddressPatch = z.infer<typeof profileAddressPatchSchema>
