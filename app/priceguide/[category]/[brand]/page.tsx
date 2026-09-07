import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PriceGuideBrandView } from "@/components/features/price-guide/price-guide-brand-view"
import { getCachedPriceGuideBrand } from "@/lib/cache/price-guide"
import { isPriceGuideCategorySlug, priceGuideCategoryLabel } from "@/lib/price-guide/categories"
import { absoluteUrl } from "@/lib/site-metadata"

export const revalidate = 3600

type Props = { params: Promise<{ category: string; brand: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, brand } = await params
  if (!isPriceGuideCategorySlug(category)) return { title: "Price Guide — Reswell" }
  const page = await getCachedPriceGuideBrand(category, brand)
  if (!page) return { title: "Price Guide — Reswell" }
  const title = `${page.brand.name} ${priceGuideCategoryLabel(category)} prices — Reswell`
  const description =
    page.entry?.summary ||
    `Used ${page.brand.name} pricing on Reswell — typical values, sold comps, and live listings.`
  const path = `/priceguide/${category}/${brand}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, type: "website", url: absoluteUrl(path) },
    twitter: { card: "summary", title, description },
  }
}

export default async function PriceGuideBrandRoute({ params }: Props) {
  const { category, brand } = await params
  if (!isPriceGuideCategorySlug(category)) notFound()
  const page = await getCachedPriceGuideBrand(category, brand)
  if (!page) notFound()
  return <PriceGuideBrandView page={page} />
}
