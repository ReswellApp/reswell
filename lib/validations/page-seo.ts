import { z } from "zod"
import { managedPageKeys } from "@/lib/seo/managed-pages"
import { dynamicPageTypeKeys } from "@/lib/seo/dynamic-page-types"

const MANAGED_KEYS = new Set([...managedPageKeys(), ...dynamicPageTypeKeys()])

/** Empty string / undefined -> undefined; otherwise trimmed text capped at `max`. */
function optionalText(max: number) {
  return z
    .union([z.string(), z.undefined(), z.null()])
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .refine((v) => v.length <= max, `Must be ${max} characters or fewer`)
    .transform((v) => (v === "" ? undefined : v))
}

/** Optional absolute https URL (or blank). */
function optionalHttpsUrl() {
  return z
    .union([z.string(), z.undefined(), z.null()])
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .refine((v) => v === "" || /^https:\/\//i.test(v), "Must be an absolute https:// URL")
    .refine((v) => v.length <= 2048, "URL is too long")
    .transform((v) => (v === "" ? undefined : v))
}

/** Optional JSON-LD object; accepts a JSON string or already-parsed object. */
const structuredDataSchema = z
  .union([z.string(), z.record(z.unknown()), z.array(z.unknown()), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (v === null || v === undefined) return undefined
    if (typeof v === "object") return v
    const trimmed = v.trim()
    if (trimmed === "") return undefined
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed === null || typeof parsed !== "object") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Structured data must be a JSON object or array" })
        return z.NEVER
      }
      return parsed as Record<string, unknown> | unknown[]
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Structured data must be valid JSON" })
      return z.NEVER
    }
  })

/** A single override payload. All fields optional; absent/blank = inherit page default. */
export const pageSeoOverrideWriteSchema = z.object({
  pageKey: z
    .string()
    .min(1)
    .refine((k) => MANAGED_KEYS.has(k), "Unknown page"),
  title: optionalText(300),
  description: optionalText(600),
  keywords: z
    .union([z.array(z.string()), z.undefined(), z.null()])
    .transform((arr) =>
      Array.isArray(arr)
        ? Array.from(
            new Set(arr.map((k) => k.trim()).filter((k) => k.length > 0 && k.length <= 80)),
          ).slice(0, 30)
        : [],
    )
    .transform((arr) => (arr.length === 0 ? undefined : arr)),
  canonicalUrl: optionalHttpsUrl(),
  robotsIndex: z.boolean().nullable().optional(),
  robotsFollow: z.boolean().nullable().optional(),
  ogTitle: optionalText(300),
  ogDescription: optionalText(600),
  ogImageUrl: optionalHttpsUrl(),
  ogType: z.enum(["website", "article"]).nullable().optional(),
  twitterCard: z.enum(["summary", "summary_large_image"]).nullable().optional(),
  twitterTitle: optionalText(300),
  twitterDescription: optionalText(600),
  twitterImageUrl: optionalHttpsUrl(),
  structuredData: structuredDataSchema,
})

export type PageSeoOverrideWriteInput = z.infer<typeof pageSeoOverrideWriteSchema>
