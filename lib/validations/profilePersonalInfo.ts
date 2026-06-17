import { z } from "zod"

export const profilePersonalInfoInputSchema = z.object({
  first_name: z.string().trim().max(100).optional().nullable(),
  last_name: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  transactional_sms_opt_in: z.boolean().optional(),
})

export const profilePersonalPhoneInputSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(10, "Enter a valid phone number.")
    .max(40, "Phone number is too long."),
})

export type ProfilePersonalInfoInput = z.infer<typeof profilePersonalInfoInputSchema>
