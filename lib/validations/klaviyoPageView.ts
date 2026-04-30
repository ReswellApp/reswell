import { z } from "zod"

/**
 * Client-reported pathname (App Router — always starts with `/`).
 * Query string may be omitted or passed without leading `?`.
 */
export const klaviyoPageViewBodySchema = z.object({
  pathname: z
    .string()
    .min(1)
    .max(2048)
    .refine((p) => p.startsWith("/") && !p.startsWith("//"), "Invalid pathname"),
  /** Search without leading `?`, e.g. `type=shortboard`; empty string OK */
  search: z.string().max(4096).optional(),
  /** Browser-persisted id for logged-out visitors (see Klaviyo `anonymous_id`) */
  anonymous_id: z.string().min(8).max(128).optional(),
})

export type KlaviyoPageViewBody = z.infer<typeof klaviyoPageViewBodySchema>
