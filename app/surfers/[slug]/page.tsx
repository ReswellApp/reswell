import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SurferProfileView } from "@/components/surfers/surfer-profile-view"
import { createAnonSupabaseClient, createClient } from "@/lib/supabase/server"
import { getSurferBySlug } from "@/lib/surfers/server"
import { absoluteUrl } from "@/lib/site-metadata"

export const revalidate = 3600

export async function generateStaticParams() {
  const supabase = createAnonSupabaseClient()
  const { data } = await supabase.from("surfers").select("slug")
  return (data ?? []).map((r) => ({ slug: r.slug }))
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createAnonSupabaseClient()
  const surfer = await getSurferBySlug(supabase, slug)
  if (!surfer) {
    return { title: "Surfer — Reswell" }
  }
  const title = `${surfer.name} · Surfer — Reswell`
  const description =
    surfer.short_description?.trim() ||
    `Read about ${surfer.name} on Reswell — bio, links, and marketplace search.`
  const path = `/surfers/${surfer.slug}`
  const url = absoluteUrl(path)
  const photo = surfer.photo_url?.trim()

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: surfer.name,
      description,
      type: "website",
      url,
      images: photo ? [{ url: photo, alt: `${surfer.name} photo` }] : undefined,
    },
    twitter: {
      card: photo ? "summary_large_image" : "summary",
      title: surfer.name,
      description,
      images: photo ? [photo] : undefined,
    },
  }
}

export default async function SurferPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const surfer = await getSurferBySlug(supabase, slug)
  if (!surfer) {
    notFound()
  }

  return <SurferProfileView surfer={surfer} />
}
