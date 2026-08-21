import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BlogCmsFloatingPanel } from "@/components/features/admin/blog/blog-cms-panel"
import { ArticlePageView } from "@/components/field-notes/article-page-view"
import { createClient } from "@/lib/supabase/server"
import {
  getPublishedArticleBySlugForSite,
  listRelatedPublishedForSite,
} from "@/lib/services/blogPublic"
import { resolveBlogListingEmbeds } from "@/lib/services/blogListingEmbeds"
import { resolveBlogAdminAccess } from "@/lib/services/blogAdminGate"
import { proxiedBlogImageSrc } from "@/lib/blog/blog-media-proxy-url"
import { absolutePublicMediaUrl, absoluteUrl, pageSeoMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await props.params
  const supabase = await createClient()
  const article = await getPublishedArticleBySlugForSite(supabase, slug)
  if (!article) {
    return pageSeoMetadata({
      title: "Article not found — Reswell",
      description: "This article is unavailable.",
      path: `/blog/${slug}`,
      robots: { index: false, follow: false },
    })
  }

  const titleSegment = article.seoTitle?.trim() || article.title
  const descriptionSegment = article.seoDescription?.trim() || article.excerpt
  const meta = pageSeoMetadata({
    title: `${titleSegment} — Reswell`,
    description: descriptionSegment,
    path: `/blog/${slug}`,
    openGraphType: "article",
  })

  const rawCandidate = absolutePublicMediaUrl(article.ogImage ?? article.coverImage)
  let ogImageAbs: string
  if (rawCandidate) {
    const proxied = proxiedBlogImageSrc(rawCandidate)
    ogImageAbs = proxied.startsWith("/") ? absoluteUrl(proxied) : proxied
  } else {
    ogImageAbs = absoluteUrl(`/blog/${slug}/opengraph-image`)
  }

  return {
    ...meta,
    openGraph: meta.openGraph ? { ...meta.openGraph, images: [{ url: ogImageAbs }] } : meta.openGraph,
    twitter: meta.twitter ? { ...meta.twitter, images: [ogImageAbs] } : meta.twitter,
  }
}

export default async function BlogArticlePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const supabase = await createClient()
  const article = await getPublishedArticleBySlugForSite(supabase, slug)
  if (!article) notFound()
  const [relatedArticles, listingEmbeds] = await Promise.all([
    listRelatedPublishedForSite(supabase, slug, 5),
    resolveBlogListingEmbeds(supabase, article.blocks),
  ])
  const { canManageBlogCms } = await resolveBlogAdminAccess()

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {canManageBlogCms ? <BlogCmsFloatingPanel /> : null}
      <ArticlePageView article={article} relatedArticles={relatedArticles} listingEmbeds={listingEmbeds} />
    </div>
  )
}
