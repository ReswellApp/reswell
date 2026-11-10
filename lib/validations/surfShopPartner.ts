import { z } from "zod"

export const surfShopPartnerApplicationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(254),
  shopName: z.string().trim().min(1, "Shop name is required").max(160),
  city: z.string().trim().min(1, "City is required").max(120),
  website: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  boardCount: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  message: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
})

export type SurfShopPartnerApplicationInput = z.infer<
  typeof surfShopPartnerApplicationSchema
>
