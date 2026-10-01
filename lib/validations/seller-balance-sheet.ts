import { z } from "zod"

export const removeBalanceSheetItemSchema = z.object({
  listingId: z.string().uuid(),
})

export type RemoveBalanceSheetItemInput = z.infer<
  typeof removeBalanceSheetItemSchema
>
