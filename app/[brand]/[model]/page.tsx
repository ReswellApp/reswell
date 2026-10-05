import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ModelPageView } from "@/components/features/models/model-page-view"
import { getDb } from "@/lib/supabase/db"
import { isReservedModelPageBrandSegment } from "@/lib/models/routes"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { getModelPage } from "@/lib/services/modelPage"
import { modelSavedSearchCriteria } from "@/lib/utils/saved-search-alert-kind"
import { absolutePublicMediaUrl, absoluteUrl } from "@/lib/site-metadata"
import { resolveDynamicSeo } from "@/lib/seo/resolve-dynamic-seo"

/**
 * Hourly ISR. This document is anonymous marketplace HTML, so the render stays
 * on the replica anon client. A session read during the static fill throws
 * DYNAMIC_SERVER_USAGE and Next serves "This page couldn't load".
 * Favorites and "Save this model" hydrate in the browser after paint.
 */
export const revalidate = 3600
export const dynamicParams = true

type Props = {
  params: Promise<{ brand: string; model: string }>
}

export function generateStaticParams(): Array<{ brand: string; model: string }> {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand: brandSlug, model: modelSlug } = await params
  if (isReservedModelPageBrandSegment(brandSlug)) {
    return { title: "Model — Reswell" }
  }

  const supabase = getDb({ consistency: "eventual" })
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

  const supabase = getDb({ consistency: "eventual" })
  const page = await getModelPage(supabase, brandSlug, modelSlug)
  if (!page) notFound()

  const criteria = modelSavedSearchCriteria({
    brandName: page.brand.name,
    brandId: page.brand.id,
    brandSlug: page.brand.slug,
    modelName: page.model.name,
    brandModelId: page.model.id,
    modelSlug: page.modelSlug,
    section: isPeerListingSection(page.model.product_category_slug)
      ? page.model.product_category_slug
      : "surfboards",
  })

  return (
    <ModelPageView
      page={page}
      criteria={criteria}
      initialSavedSearchId={null}
      favoritedListingIds={[]}
      isLoggedIn={false}
      viewerUserId={null}
    />
  )
}
