import { z } from "zod"

export const surfShopPartnerApplicationSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(254),
  shopName: z.string().trim().min(1, "Shop name is required").max(160),
  city: z.string().trim().min(1, "City is required").max(120),
})

export type SurfShopPartnerApplicationInput = z.infer<
  typeof surfShopPartnerApplicationSchema
>
