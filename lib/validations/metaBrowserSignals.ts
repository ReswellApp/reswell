import { z } from "zod"

/** Optional `_fbc` / `_fbp` values from the browser Parameter Builder (CAPI match keys). */
export const metaBrowserSignalsSchema = z.object({
  fbc: z.string().trim().min(1).max(512).optional(),
  fbp: z.string().trim().min(1).max(512).optional(),
})

export type MetaBrowserSignalsInput = z.infer<typeof metaBrowserSignalsSchema>
