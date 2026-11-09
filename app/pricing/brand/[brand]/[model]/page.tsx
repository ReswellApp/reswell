import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ModelPricingView } from "@/components/features/pricing/model-pricing-view"
import { hasIndexableModelPriceGuide } from "@/lib/models/model-page-indexable"
import { isReservedModelPageBrandSegment } from "@/lib/models/routes"
import {
  buildModelPricingView,
  isModelPricingPageIndexable,
  modelPricingHref,
} from "@/lib/pricing/model-pricing"
import { getModelPage } from "@/lib/services/modelPage"
import { absolutePublicMediaUrl, absoluteUrl } from "@/lib/site-metadata"
import { getDb } from "@/lib/supabase/db"

/**
 * Hourly ISR. Anonymous marketplace HTML — same replica client as the model
 * page, with no session read during render.
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
    return { title: "Pricing — Reswell", robots: { index: false, follow: false } }
  }

  const supabase = getDb({ consistency: "eventual" })
  const page = await getModelPage(supabase, brandSlug, modelSlug)
  if (!page) return { title: "Pricing — Reswell", robots: { index: false, follow: false } }

  const view = buildModelPricingView(page)
  const titleName = `${page.brand.name} ${page.model.name}`
  const title = `${titleName} pricing — Reswell`
  const description =
    view.rangeLabel === "—"
      ? `Used ${titleName} pricing, live listings, and recent sales on Reswell.`
      : `Used ${titleName} pricing on Reswell. Recent sales range ${view.rangeLabel}.`
  const path = modelPricingHref(page.brand.slug, page.modelSlug)
  const shareImage = absolutePublicMediaUrl(view.imageUrl)
  const indexable = isModelPricingPageIndexable({
    listingCount: page.listings.length,
    soldListingCount: page.soldListings.length,
    guideSoldCount: page.priceGuide?.sold.count ?? 0,
    guideAskingCount: page.priceGuide?.asking.count ?? 0,
    hasPriceGuide: hasIndexableModelPriceGuide(page.priceGuide),
  })

  return {
    title,
    description,
    alternates: { canonical: path },
    robots: {
      index: indexable,
      follow: true,
      googleBot: { index: indexable, follow: true },
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: absoluteUrl(path),
      ...(shareImage ? { images: [{ url: shareImage }] } : {}),
    },
    twitter: {
      card: shareImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(shareImage ? { images: [shareImage] } : {}),
    },
  }
}

export default async function ModelPricingPage({ params }: Props) {
  const { brand: brandSlug, model: modelSlug } = await params
  if (isReservedModelPageBrandSegment(brandSlug)) notFound()

  const supabase = getDb({ consistency: "eventual" })
  const page = await getModelPage(supabase, brandSlug, modelSlug)
  if (!page) notFound()

  return <ModelPricingView page={buildModelPricingView(page)} />
}
