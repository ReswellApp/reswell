import { proxiedBlogImageSrc } from "@/lib/blog/blog-media-proxy-url"

export type ArticleBlock =
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "image"; url: string; alt?: string; caption?: string; width?: number; height?: number }
  | { kind: "instagram"; url: string }
  | { kind: "listing"; ref: string }
  | { kind: "listing-image"; ref: string; caption?: string }
  | { kind: "sold-listings"; limit?: number }

export type FieldNoteArticle = {
  /** Present when sourced from Postgres. */
  id?: string
  slug: string
  title: string
  deck: string
  excerpt: string
  author: string
  publishedAt: string
  readMinutes: number
  tag: string
  /** HTTPS URL stored as saved (often Supabase public URL); storefront rewrites via `/media/blog/…`. */
  coverImage?: string
  seoTitle?: string | null
  seoDescription?: string | null
  ogImage?: string | null
  /** Present for CMS payloads mapped from Postgres. */
  published?: boolean
  /** When false, post is omitted from `/blog` index but may still load at `/blog/[slug]` if published. */
  listedOnBlog?: boolean
  sortOrder?: number
  /** Row `updated_at` — used to cache-bust cover URLs on the index. */
  updatedAt?: string
  blocks: ArticleBlock[]
}

function cacheBustMediaSrc(src: string, version: string | undefined): string {
  const v = version?.trim()
  if (!v) return src
  const token = encodeURIComponent(v)
  return src.includes("?") ? `${src}&v=${token}` : `${src}?v=${token}`
}

/** Public cover URL via proxy, or `null` when the post has no cover (title card is used instead). */
export function getFieldNoteCoverSrc(article: FieldNoteArticle): string | null {
  const url = article.coverImage?.trim()
  if (!url) return null
  return cacheBustMediaSrc(proxiedBlogImageSrc(url), article.updatedAt)
}
