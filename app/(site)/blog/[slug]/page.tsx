import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  getAllFieldNoteSlugs,
  getFieldNoteBySlug,
} from "@/lib/field-notes-articles"
import { ArticlePageView } from "@/components/field-notes/article-page-view"

export const revalidate = 3600

export function generateStaticParams() {
  return getAllFieldNoteSlugs().map((slug) => ({ slug }))
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = getFieldNoteBySlug(slug)
  if (!article) {
    return { title: "Article" }
  }
  return {
    title: article.title,
    description: article.excerpt,
  }
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params
  const article = getFieldNoteBySlug(slug)
  if (!article) {
    notFound()
  }
  return <ArticlePageView article={article} />
}
