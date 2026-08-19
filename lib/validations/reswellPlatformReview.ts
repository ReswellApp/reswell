import { z } from "zod"

export const reswellPlatformReviewSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(120, "Name is too long."),
  title: z
    .string()
    .trim()
    .max(120, "Title is too long.")
    .optional(),
  description: z
    .string()
    .trim()
    .min(10, "Share a bit more detail about your experience.")
    .max(2000, "Description is too long."),
  rating: z
    .number()
    .int("Choose a whole-star rating.")
    .min(1, "Choose at least 1 star.")
    .max(5, "Maximum rating is 5 stars."),
})

export const soldFlowReswellReviewSchema = z.object({
  rating: z
    .number()
    .int("Choose a whole star rating.")
    .min(1, "Choose at least 1 star.")
    .max(5, "Maximum rating is 5 stars."),
  description: z
    .string()
    .trim()
    .min(10, "Share a bit more about your experience.")
    .max(2000, "Review is too long."),
})

export type ReswellPlatformReviewInput = z.infer<typeof reswellPlatformReviewSchema>
export type SoldFlowReswellReviewInput = z.infer<typeof soldFlowReswellReviewSchema>
