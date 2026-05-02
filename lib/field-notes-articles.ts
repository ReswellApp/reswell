import { proxiedBlogImageSrc } from "@/lib/blog/blog-media-proxy-url"

export type ArticleBlock =
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "image"; url: string; alt?: string; caption?: string }
  | { kind: "instagram"; url: string }

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
  blocks: ArticleBlock[]
}

/** Public cover URL via proxy, or `null` when the post has no cover (no placeholder imagery). */
export function getFieldNoteCoverSrc(article: FieldNoteArticle): string | null {
  const url = article.coverImage?.trim()
  if (!url) return null
  return proxiedBlogImageSrc(url)
}
