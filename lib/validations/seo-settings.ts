import { z } from "zod"

/** Normalize a path entry for robots rules: leading slash, trimmed, no whitespace. */
function normalizePathEntry(value: string): string | null {
  const t = value.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t // allow absolute (rare, but permitted)
  return t.startsWith("/") ? t : `/${t}`
}

const pathList = z
  .array(z.string())
  .max(100)
  .transform((arr) =>
    Array.from(
      new Set(arr.map(normalizePathEntry).filter((v): v is string => v !== null)),
    ),
  )

const urlList = z
  .array(z.string())
  .max(20)
  .transform((arr) =>
    Array.from(
      new Set(
        arr
          .map((s) => s.trim())
          .filter((s) => /^https?:\/\//i.test(s)),
      ),
    ),
  )

export const seoSettingsWriteSchema = z.object({
  discourageAllCrawlers: z.boolean(),
  extraDisallow: pathList,
  extraAllow: pathList,
  crawlDelay: z.number().int().min(0).max(60).nullable(),
  extraSitemaps: urlList,
})

export type SeoSettingsWriteInput = z.infer<typeof seoSettingsWriteSchema>
