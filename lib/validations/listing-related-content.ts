import { z } from "zod"

export const relatedContentListingIdSchema = z.string().uuid()

export const adminRelatedContentSearchQuerySchema = z.object({
  type: z.enum(["listing", "blog", "host"]),
  q: z.string().trim().max(120).optional().default(""),
  host_listing_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
})

export const adminAddRelatedContentBodySchema = z
  .object({
    kind: z.enum(["blog", "listing"]),
    blog_post_id: z.string().uuid().optional(),
    related_listing_id: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "blog") {
      if (!value.blog_post_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "blog_post_id is required",
          path: ["blog_post_id"],
        })
      }
      if (value.related_listing_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "related_listing_id must be empty for blog items",
          path: ["related_listing_id"],
        })
      }
      return
    }
    if (!value.related_listing_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "related_listing_id is required",
        path: ["related_listing_id"],
      })
    }
    if (value.blog_post_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "blog_post_id must be empty for listing items",
        path: ["blog_post_id"],
      })
    }
  })

export const adminReorderRelatedContentBodySchema = z.object({
  ordered_row_ids: z.array(z.string().uuid()).min(1).max(40),
})

export type AdminAddRelatedContentBody = z.infer<typeof adminAddRelatedContentBodySchema>
