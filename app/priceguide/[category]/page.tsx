import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PriceGuideCategoryView } from "@/components/features/price-guide/price-guide-category-view"
import { getCachedPriceGuideCategory } from "@/lib/cache/price-guide"
import {
  isPriceGuideCategorySlug,
  PRICE_GUIDE_CATEGORY_SLUGS,
  priceGuideCategoryLabel,
} from "@/lib/price-guide/categories"
import { absoluteUrl } from "@/lib/site-metadata"

export const revalidate = 3600

type Props = { params: Promise<{ category: string }> }

export function generateStaticParams() {
  return PRICE_GUIDE_CATEGORY_SLUGS.map((category) => ({ category }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params
  if (!isPriceGuideCategorySlug(category)) return { title: "Price Guide — Reswell" }
  const label = priceGuideCategoryLabel(category)
  const title = `${label} price guide — Reswell`
  const description = `See what used ${label.toLowerCase()} are worth on Reswell — asking prices, sold comps, and brand-level ranges.`
  const path = `/priceguide/${category}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, type: "website", url: absoluteUrl(path) },
    twitter: { card: "summary", title, description },
  }
}

export default async function PriceGuideCategoryPage({ params }: Props) {
  const { category } = await params
  if (!isPriceGuideCategorySlug(category)) notFound()
  const page = await getCachedPriceGuideCategory(category)
  return <PriceGuideCategoryView page={page} />
}
