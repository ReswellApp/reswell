import { z } from "zod"
import { shippingLabelParcelSchema } from "@/lib/validations/order-shipping-label"

export const adminUserShippingLabelShipToSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().default(""),
  company_name: z.string().trim().max(120).optional().default(""),
  address_line1: z.string().trim().min(1).max(200),
  address_line2: z.string().trim().max(200).optional().default(""),
  city_locality: z.string().trim().min(1).max(120),
  state_province: z.string().trim().min(1).max(40),
  postal_code: z.string().trim().min(3).max(20),
  country_code: z.string().trim().min(2).max(40).optional().default("US"),
  residential: z.enum(["yes", "no", "unknown"]).optional().default("yes"),
})

export const adminUserShippingLabelQuerySchema = z.object({
  user_id: z.string().uuid(),
})

export const adminUserShippingLabelPostBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rates"),
    user_id: z.string().uuid(),
    parcel: shippingLabelParcelSchema,
    ship_to: adminUserShippingLabelShipToSchema,
  }),
  z.object({
    action: z.literal("purchase"),
    user_id: z.string().uuid(),
    rate_id: z.string().min(5).max(128),
    parcel: shippingLabelParcelSchema,
    ship_to: adminUserShippingLabelShipToSchema,
  }),
])

export type AdminUserShippingLabelShipTo = z.infer<typeof adminUserShippingLabelShipToSchema>
export type AdminUserShippingLabelPostBody = z.infer<typeof adminUserShippingLabelPostBodySchema>
