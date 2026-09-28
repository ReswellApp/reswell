import { z } from "zod"
import {
  FEATURE_REQUEST_KINDS,
  FEATURE_REQUEST_STATUSES,
  FEATURE_REQUEST_TAGS,
} from "../types/feature-requests.ts"

export const createFeatureRequestSchema = z.object({
  kind: z.enum(FEATURE_REQUEST_KINDS),
  title: z
    .string()
    .trim()
    .min(4, "Title must be at least 4 characters.")
    .max(140, "Title must be 140 characters or fewer."),
  body: z
    .string()
    .trim()
    .min(10, "Add a bit more detail (at least 10 characters).")
    .max(5000, "Description must be 5,000 characters or fewer."),
  tags: z.array(z.enum(FEATURE_REQUEST_TAGS)).max(4, "Pick up to 4 tags.").default([]),
})

export const featureRequestVoteSchema = z.object({
  requestId: z.string().uuid(),
})

export const featureRequestCommentSchema = z.object({
  requestId: z.string().uuid(),
  body: z
    .string()
    .trim()
    .min(1, "Write a comment first.")
    .max(2000, "Comments must be 2,000 characters or fewer."),
})

export const deleteFeatureRequestCommentSchema = z.object({
  commentId: z.string().uuid(),
})

export const updateFeatureRequestStaffSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(FEATURE_REQUEST_STATUSES),
  tags: z.array(z.enum(FEATURE_REQUEST_TAGS)).max(4),
  estimatedLabel: z
    .string()
    .trim()
    .max(40, "Keep the estimate under 40 characters.")
    .optional()
    .nullable(),
})

export const publishFeatureRequestChangelogSchema = z.object({
  requestId: z.string().uuid(),
  title: z
    .string()
    .trim()
    .min(4, "Title must be at least 4 characters.")
    .max(140, "Title must be 140 characters or fewer."),
  body: z
    .string()
    .trim()
    .min(10, "Add a bit more detail (at least 10 characters).")
    .max(5000, "Description must be 5,000 characters or fewer."),
})

export const deleteFeatureRequestSchema = z.object({
  requestId: z.string().uuid(),
})

export type CreateFeatureRequestInput = z.infer<typeof createFeatureRequestSchema>
export type FeatureRequestCommentInput = z.infer<typeof featureRequestCommentSchema>
export type UpdateFeatureRequestStaffInput = z.infer<typeof updateFeatureRequestStaffSchema>
export type PublishFeatureRequestChangelogInput = z.infer<typeof publishFeatureRequestChangelogSchema>
