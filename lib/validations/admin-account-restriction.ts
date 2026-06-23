import { z } from "zod"

export const adminAccountRestrictionPatchSchema = z
  .object({
    restricted: z.boolean(),
    /** ISO timestamp when the restriction ends. Omit or null for indefinite lock. */
    restrictedUntil: z.string().datetime().nullable().optional(),
    /** Convenience preset in minutes — ignored when restricted is false. */
    durationMinutes: z.number().int().positive().max(60 * 24 * 365).optional(),
    reason: z.string().max(500).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.restricted) return
    if (value.restrictedUntil && value.durationMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either restrictedUntil or durationMinutes, not both.",
        path: ["durationMinutes"],
      })
    }
  })
