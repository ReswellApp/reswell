import { z } from "zod"
import {
  BLOG_COPYRIGHT_FREE_IMAGE_ERROR,
  isCopyrightFreeBlogImageUrl,
} from "@/lib/blog/copyright-free-image-url"
import { instagramPermalinkToEmbedSrc } from "@/lib/utils/instagram-embed"

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const blogSlugSchema = z
  .string()
  .min(2)
  .max(200)
  .regex(slugRegex, "Slug: lowercase letters, numbers, hyphen only")

/** Instagram post URL (permalink); embed src is derived in the renderer. */
const instagramSchema = z
  .string()
  .url()
  .refine((u) => instagramPermalinkToEmbedSrc(u) !== null, "Paste a standard Instagram post or reel URL")

const httpsCopyrightFreeImageUrl = z
  .string()
  .url()
  .refine((u) => /^https:/i.test(u), "Cover and images must use HTTPS")
  .refine((u) => isCopyrightFreeBlogImageUrl(u), BLOG_COPYRIGHT_FREE_IMAGE_ERROR)

const imageSchema = z.object({
  kind: z.literal("image"),
  url: httpsCopyrightFreeImageUrl,
  alt: z.string().max(500).optional(),
  caption: z.string().max(2000).optional(),
  width: z.coerce.number().int().positive().max(20_000).optional(),
  height: z.coerce.number().int().positive().max(20_000).optional(),
})

export const articleBlockSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("h2"),
    text: z.string().min(1).max(12_000),
  }),
  z.object({
    kind: z.literal("p"),
    text: z.string().min(1).max(120_000),
  }),
  imageSchema,
  z.object({
    kind: z.literal("instagram"),
    url: instagramSchema,
  }),
])

export const articleBlocksSchema = z.array(articleBlockSchema)

const blogDraftCoreSchema = z.object({
  slug: blogSlugSchema,
  title: z.string().min(1).max(500),
  deck: z.string().max(2000),
  excerpt: z.string().min(1).max(2500),
  author: z.string().min(1).max(200),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  readMinutes: z.coerce.number().int().min(1).max(480),
  tag: z.string().min(1).max(120),
  coverImage: z
    .union([z.string().url(), z.literal(""), z.undefined()])
    .refine((v) => v === undefined || v === "" || /^https:/i.test(v), "HTTPS only")
    .refine(
      (v) => v === undefined || v === "" || isCopyrightFreeBlogImageUrl(v),
      BLOG_COPYRIGHT_FREE_IMAGE_ERROR,
    )
    .transform((v) => (v === "" ? undefined : v)),
  blocks: articleBlocksSchema,
  seoTitle: z.union([z.string().max(500), z.literal(""), z.undefined()]).transform((v) => (v === "" ? undefined : v)),
  seoDescription: z.union([z.string().max(2500), z.literal(""), z.undefined()]).transform((v) =>
    v === "" ? undefined : v,
  ),
  ogImage: z
    .union([z.string().url(), z.literal(""), z.undefined()])
    .refine((v) => v === undefined || v === "" || /^https:/i.test(v), "HTTPS only")
    .refine(
      (v) => v === undefined || v === "" || isCopyrightFreeBlogImageUrl(v),
      BLOG_COPYRIGHT_FREE_IMAGE_ERROR,
    )
    .transform((v) => (v === "" ? undefined : v)),
  published: z.boolean(),
  /** When false, `/blog` index omits the post; `/blog/[slug]` still works if published. */
  listedOnBlog: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().optional(),
})

/** Create + full replace update payload (admin CMS). */
export const adminBlogPostWriteSchema = blogDraftCoreSchema

export const reorderBlogPostsBodySchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
})

export const blogPostVisibilityActionSchema = z.object({
  action: z.enum(["hide", "show", "archive"]),
})
