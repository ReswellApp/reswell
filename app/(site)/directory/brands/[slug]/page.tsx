import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BrandProfileView } from "@/components/index-directory/brand-profile-view"
import { getAllBrandSlugs, getBrandProfileBySlug } from "@/lib/index-directory/registry"

export const revalidate = 3600

export function generateStaticParams() {
  return getAllBrandSlugs().map((slug) => ({ slug }))
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const profile = getBrandProfileBySlug(slug)
  if (!profile) {
    return { title: "Brand" }
  }
  return {
    title: profile.name,
    description: profile.shortDescription,
  }
}

export default async function IndexBrandProfilePage({ params }: Props) {
  const { slug } = await params
  const profile = getBrandProfileBySlug(slug)
  if (!profile) {
    notFound()
  }
  return <BrandProfileView profile={profile} />
}
