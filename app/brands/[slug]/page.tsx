import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BrandProfileView } from "@/components/brands/brand-profile-view"
import { createAnonSupabaseClient } from "@/lib/supabase/server"
import { getBrandBySlug } from "@/lib/brands/server"

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
    return { title: "Brand" }
  }
  return {
    title: brand.name,
    description: brand.short_description ?? undefined,
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
