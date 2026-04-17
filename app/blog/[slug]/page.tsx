import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await props.params
  return privatePageMetadata({
    title: "Blog — Reswell",
    description: "This article is unavailable — returning you to the Reswell homepage.",
    path: `/blog/${slug}`,
  })
}

export default function BlogArticlePage() {
  redirect("/")
}
