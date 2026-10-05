import { z } from "zod"

export const shopVacationModeBodySchema = z.object({
  vacationMode: z.boolean(),
})

export type ShopVacationModeBody = z.infer<typeof shopVacationModeBodySchema>
