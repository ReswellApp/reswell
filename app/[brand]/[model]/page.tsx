import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ModelPageView } from "@/components/features/models/model-page-view"
import { createAnonSupabaseClient, createClient } from "@/lib/supabase/server"
import { fetchBrandModelSitemapEntries } from "@/lib/db/sitemap-models"
import { isReservedModelPageBrandSegment } from "@/lib/models/routes"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { getModelPage } from "@/lib/services/modelPage"
import { absolutePublicMediaUrl, absoluteUrl } from "@/lib/site-metadata"
import { resolveDynamicSeo } from "@/lib/seo/resolve-dynamic-seo"

export const revalidate = 3600

type Props = {
  params: Promise<{ brand: string; model: string }>
}

export async function generateStaticParams() {
  const supabase = createAnonSupabaseClient()
  const rows = await fetchBrandModelSitemapEntries(supabase)
  return rows.map((row) => ({ brand: row.brandSlug, model: row.modelSlug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand: brandSlug, model: modelSlug } = await params
  if (isReservedModelPageBrandSegment(brandSlug)) {
    return { title: "Model — Reswell" }
  }

  const supabase = createAnonSupabaseClient()
  const page = await getModelPage(supabase, brandSlug, modelSlug)
  if (!page) return { title: "Model — Reswell" }

  const titleName = `${page.brand.name} ${page.model.name}`
  const fallbackTitle = `${titleName} — Reswell`
  const fallbackDescription =
    page.model.description?.trim() ||
    `Used ${titleName} listings, product details, price guide, and reviews on Reswell.`
  const seo = await resolveDynamicSeo(
    "type:brand",
    { name: titleName, tagline: page.model.description?.trim() || undefined },
    { title: fallbackTitle, description: fallbackDescription },
  )
  const path = `/${page.brand.slug}/${page.modelSlug}`
  const shareImage = absolutePublicMediaUrl(page.listingImageUrl)
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: path },
    openGraph: {
      title: titleName,
      description: seo.description,
      type: "website",
      url: absoluteUrl(path),
      ...(shareImage ? { images: [{ url: shareImage }] } : {}),
    },
    twitter: {
      card: shareImage ? "summary_large_image" : "summary",
      title: titleName,
      description: seo.description,
      ...(shareImage ? { images: [shareImage] } : {}),
    },
  }
}

export default async function ModelPage({ params }: Props) {
  const { brand: brandSlug, model: modelSlug } = await params
  if (isReservedModelPageBrandSegment(brandSlug)) notFound()

  const supabase = await createClient()
  const page = await getModelPage(supabase, brandSlug, modelSlug)
  if (!page) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  let favoritedListingIds: string[] = []
  if (user && page.listings.length > 0) {
    const ids = page.listings.map((listing) => listing.id)
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in("listing_id", ids)
    favoritedListingIds = (favs ?? []).map((row) => row.listing_id)
  }

  return (
    <ModelPageView
      page={page}
      criteria={{
        section: isPeerListingSection(page.model.product_category_slug)
          ? page.model.product_category_slug
          : "surfboards",
        brand: page.brand.name,
        brandId: page.brand.id,
        model: page.model.name,
        brandModelId: page.model.id,
      }}
      favoritedListingIds={favoritedListingIds}
      isLoggedIn={!!user}
      viewerUserId={user?.id ?? null}
    />
  )
}
