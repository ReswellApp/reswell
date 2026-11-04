import { z } from "zod"
import { BRAND_PRODUCT_CATEGORY_SLUGS } from "@/lib/brand-product-categories"
import { isValidBrandSlug } from "@/lib/brands/slug"
import { adminBlogPostWriteSchema } from "@/lib/validations/blog"
import {
  adminBrandModelCreateBodySchema,
  adminBrandModelPatchBodySchema,
} from "@/lib/validations/brand-models"

const optionalHttpsUrl = z
  .union([z.string().url(), z.literal(""), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined
    if (v === null || v === "") return null
    return v.trim()
  })

export const staffListBrandsArgsSchema = z.object({
  query: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
})

export const staffGetBrandArgsSchema = z.object({
  brand_id: z.string().trim().uuid().optional(),
  slug: z.string().trim().min(1).max(128).optional(),
}).refine((v) => Boolean(v.brand_id || v.slug), {
  message: "Provide brand_id or slug",
})

export const staffCreateBrandArgsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .refine((s) => isValidBrandSlug(s), "Invalid slug (lowercase letters, numbers, hyphens)"),
  name: z.string().trim().min(1).max(200),
  short_description: z.string().trim().max(2000).nullable().optional(),
  website_url: optionalHttpsUrl,
  logo_url: optionalHttpsUrl,
  founder_name: z.string().trim().max(200).nullable().optional(),
  lead_shaper_name: z.string().trim().max(200).nullable().optional(),
  location_label: z.string().trim().max(200).nullable().optional(),
  model_count: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  product_categories: z
    .array(z.enum(BRAND_PRODUCT_CATEGORY_SLUGS))
    .min(1)
    .max(8)
    .optional()
    .default(["surfboards"]),
})

export const staffUpdateBrandArgsSchema = z.object({
  brand_id: z.string().trim().uuid().optional(),
  slug: z.string().trim().min(1).max(128).optional(),
  patch: z
    .object({
      slug: z
        .string()
        .trim()
        .min(1)
        .max(128)
        .refine((s) => isValidBrandSlug(s), "Invalid slug")
        .optional(),
      name: z.string().trim().min(1).max(200).optional(),
      short_description: z.string().trim().max(2000).nullable().optional(),
      website_url: optionalHttpsUrl,
      logo_url: optionalHttpsUrl,
      founder_name: z.string().trim().max(200).nullable().optional(),
      lead_shaper_name: z.string().trim().max(200).nullable().optional(),
      location_label: z.string().trim().max(200).nullable().optional(),
      model_count: z.coerce.number().int().min(0).max(1_000_000).optional(),
      product_categories: z.array(z.enum(BRAND_PRODUCT_CATEGORY_SLUGS)).min(1).max(8).optional(),
    })
    .refine((p) => Object.keys(p).length > 0, { message: "patch must include at least one field" }),
}).refine((v) => Boolean(v.brand_id || v.slug), {
  message: "Provide brand_id or slug",
})

export const staffListModelsArgsSchema = z.object({
  brand_id: z.string().trim().uuid().optional(),
  brand_slug: z.string().trim().min(1).max(128).optional(),
  query: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const staffGetModelArgsSchema = z.object({
  model_id: z.string().trim().uuid(),
})

export const staffCreateModelArgsSchema = adminBrandModelCreateBodySchema

export const staffUpdateModelArgsSchema = z.object({
  model_id: z.string().trim().uuid(),
  patch: adminBrandModelPatchBodySchema.refine(
    (p) => Object.keys(p).length > 0,
    { message: "patch must include at least one field" },
  ),
})

export const staffListBlogPostsArgsSchema = z.object({
  query: z.string().trim().max(120).optional(),
  published_only: z.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(100).default(40),
})

export const staffGetBlogPostArgsSchema = z.object({
  post_id: z.string().trim().uuid().optional(),
  slug: z.string().trim().min(1).max(200).optional(),
}).refine((v) => Boolean(v.post_id || v.slug), {
  message: "Provide post_id or slug",
})

export const staffCreateBlogPostArgsSchema = adminBlogPostWriteSchema

export const staffUpdateBlogPostArgsSchema = z.object({
  post_id: z.string().trim().uuid(),
  draft: adminBlogPostWriteSchema,
})

export const staffSetBlogVisibilityArgsSchema = z.object({
  post_id: z.string().trim().uuid(),
  action: z.enum(["hide", "show", "archive", "publish"]),
})
