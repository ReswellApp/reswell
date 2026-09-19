import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BrandProfileView } from "@/components/brands/brand-profile-view"
import { createAnonSupabaseClient, createClient } from "@/lib/supabase/server"
import { getBrandBySlug } from "@/lib/brands/server"
import { parseBrandPageTab } from "@/lib/brands/routes"
import { listActiveListingsForBrand, listRecentlySoldListingsForBrand } from "@/lib/db/brand-listings"
import { absoluteUrl } from "@/lib/site-metadata"
import { resolveDynamicSeo } from "@/lib/seo/resolve-dynamic-seo"

export const revalidate = 3600

export async function generateStaticParams() {
  const supabase = createAnonSupabaseClient()
  const { data } = await supabase.from("brands").select("slug")
  return (data ?? []).map((r) => ({ slug: r.slug }))
}

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createAnonSupabaseClient()
  const brand = await getBrandBySlug(supabase, slug)
  if (!brand) {
    return { title: "Brand — Reswell" }
  }
  const fallbackTitle = `${brand.name} · Surf brand — Reswell`
  const fallbackDescription =
    brand.short_description?.trim() ||
    `Used ${brand.name} on Reswell — current listings and recently sold gear.`
  const seo = await resolveDynamicSeo(
    "type:brand",
    { name: brand.name, tagline: brand.short_description?.trim() || undefined },
    { title: fallbackTitle, description: fallbackDescription },
  )
  const title = seo.title
  const description = seo.description
  const path = `/brands/${brand.slug}`
  const url = absoluteUrl(path)
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: brand.name,
      description,
      type: "website",
      url,
    },
    twitter: {
      card: "summary",
      title: brand.name,
      description,
    },
  }
}

const BRAND_PAGE_LISTING_LIMIT = 48

export default async function BrandPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { tab } = await searchParams
  const supabase = await createClient()
  const brand = await getBrandBySlug(supabase, slug)
  if (!brand) {
    notFound()
  }

  const brandRef = { id: brand.id, name: brand.name }
  const [brandListings, brandSoldListings] = await Promise.all([
    listActiveListingsForBrand(supabase, brandRef, { limit: BRAND_PAGE_LISTING_LIMIT }),
    listRecentlySoldListingsForBrand(supabase, brandRef, { limit: BRAND_PAGE_LISTING_LIMIT }),
  ])

  const {
    data: { user },
  } = await supabase.auth.getUser()
  let favoritedListingIds: string[] = []
  if (user) {
    const ids = [...new Set([...brandListings, ...brandSoldListings].map((l) => l.id))]
    if (ids.length > 0) {
      const { data: favs } = await supabase
        .from("favorites")
        .select("listing_id")
        .eq("user_id", user.id)
        .in("listing_id", ids)
      favoritedListingIds = (favs ?? []).map((f) => f.listing_id)
    }
  }

  return (
    <BrandProfileView
      brand={brand}
      initialTab={parseBrandPageTab(tab)}
      brandListings={brandListings}
      brandSoldListings={brandSoldListings}
      listingsCapped={brandListings.length >= BRAND_PAGE_LISTING_LIMIT}
      soldCapped={brandSoldListings.length >= BRAND_PAGE_LISTING_LIMIT}
      favoritedListingIds={favoritedListingIds}
      isLoggedIn={!!user}
      viewerUserId={user?.id ?? null}
    />
  )
}
