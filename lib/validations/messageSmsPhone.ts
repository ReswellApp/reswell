import { z } from "zod"

export const messageSmsPhoneInputSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(10, "Enter a valid phone number.")
    .max(40, "Phone number is too long."),
})

export type MessageSmsPhoneInput = z.infer<typeof messageSmsPhoneInputSchema>
