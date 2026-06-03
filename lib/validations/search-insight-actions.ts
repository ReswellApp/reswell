import { z } from "zod"

/** Lifecycle for a single insight in the shared triage queue. */
export const SEARCH_INSIGHT_STATUSES = [
  "open",
  "in_progress",
  "snoozed",
  "done",
  "dismissed",
] as const

export const searchInsightStatusSchema = z.enum(SEARCH_INSIGHT_STATUSES)

export type SearchInsightStatus = z.infer<typeof searchInsightStatusSchema>

/** Upsert payload from the admin dashboard. `null` clears the optional field. */
export const upsertSearchInsightActionSchema = z.object({
  insightId: z.string().trim().min(1).max(200),
  status: searchInsightStatusSchema,
  snoozeUntil: z.string().datetime().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be yyyy-MM-dd")
    .nullable()
    .optional(),
  note: z.string().trim().max(2000).nullable().optional(),
})

export type UpsertSearchInsightActionInput = z.infer<
  typeof upsertSearchInsightActionSchema
>

/** Default snooze length (days) when an insight is snoozed without an explicit date. */
export const SEARCH_INSIGHT_SNOOZE_DAYS = 7
