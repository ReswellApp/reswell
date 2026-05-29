import { z } from "zod"

const REDIRECT_STATUS = [301, 302, 307, 308] as const

/** Normalize an incoming path: ensure leading slash, strip origin/query/hash and trailing slash. */
export function normalizeRedirectPath(input: string): string {
  let p = input.trim()
  // Strip an accidental absolute URL down to its path.
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname
  } catch {
    /* keep raw */
  }
  p = p.split("#")[0].split("?")[0]
  if (!p.startsWith("/")) p = `/${p}`
  // Drop trailing slash except for root.
  if (p.length > 1) p = p.replace(/\/+$/, "")
  return p || "/"
}

/** Destination may be an internal path or an absolute URL. */
function normalizeDestination(input: string): string {
  const d = input.trim()
  if (/^https?:\/\//i.test(d)) return d
  return normalizeRedirectPath(d)
}

export const seoRedirectWriteSchema = z
  .object({
    fromPath: z.string().min(1).max(2048).transform(normalizeRedirectPath),
    toPath: z.string().min(1).max(2048).transform(normalizeDestination),
    statusCode: z
      .union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)])
      .default(301),
    enabled: z.boolean().default(true),
    note: z
      .string()
      .max(300)
      .optional()
      .transform((v) => (v && v.trim() ? v.trim() : null)),
  })
  .refine((d) => d.fromPath !== d.toPath, {
    message: "Source and destination cannot be the same.",
    path: ["toPath"],
  })

export type SeoRedirectWriteInput = z.infer<typeof seoRedirectWriteSchema>

export const REDIRECT_STATUS_OPTIONS = REDIRECT_STATUS
