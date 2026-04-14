import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BrandProfileView } from "@/components/brands/brand-profile-view"
import { createAnonSupabaseClient } from "@/lib/supabase/server"
import { getBrandBySlug } from "@/lib/brands/server"
import { absoluteUrl } from "@/lib/site-metadata"

export const revalidate = 3600

export async function generateStaticParams() {
  const supabase = createAnonSupabaseClient()
  const { data } = await supabase.from("brands").select("slug")
  return (data ?? []).map((r) => ({ slug: r.slug }))
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createAnonSupabaseClient()
  const brand = await getBrandBySlug(supabase, slug)
  if (!brand) {
    return { title: "Brand — Reswell" }
  }
  const title = `${brand.name} · Surf brand — Reswell`
  const description =
    brand.short_description?.trim() ||
    `Explore ${brand.name} on Reswell — models, stories, and where to find their boards.`
  const path = `/brands/${brand.slug}`
  const url = absoluteUrl(path)
  const logo = brand.logo_url?.trim()

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: brand.name,
      description,
      type: "website",
      url,
      images: logo ? [{ url: logo, alt: `${brand.name} logo` }] : undefined,
    },
    twitter: {
      card: logo ? "summary_large_image" : "summary",
      title: brand.name,
      description,
      images: logo ? [logo] : undefined,
    },
  }
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params
  const supabase = createAnonSupabaseClient()
  const brand = await getBrandBySlug(supabase, slug)
  if (!brand) {
    notFound()
  }
  return <BrandProfileView brand={brand} />
}
