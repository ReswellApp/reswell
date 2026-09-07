import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PriceGuideModelView } from "@/components/features/price-guide/price-guide-model-view"
import { getCachedPriceGuideModel } from "@/lib/cache/price-guide"
import { isPriceGuideCategorySlug } from "@/lib/price-guide/categories"
import { formatGuideUsd } from "@/lib/price-guide/format"
import { absoluteUrl } from "@/lib/site-metadata"

export const revalidate = 3600

type Props = { params: Promise<{ category: string; brand: string; model: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, brand, model } = await params
  if (!isPriceGuideCategorySlug(category)) return { title: "Price Guide — Reswell" }
  const page = await getCachedPriceGuideModel(category, brand, model)
  if (!page) return { title: "Price Guide — Reswell" }
  const mid = formatGuideUsd(page.typical.mid_usd)
  const title = `${page.brand.name} ${page.model.name} value — ${mid} | Reswell Price Guide`
  const description =
    page.entry?.summary ||
    `Typical used value for the ${page.brand.name} ${page.model.name}: ${mid}. Sold comps and live listings from Reswell.`
  const path = `/priceguide/${category}/${brand}/${model}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, type: "website", url: absoluteUrl(path) },
    twitter: { card: "summary", title, description },
  }
}

export default async function PriceGuideModelRoute({ params }: Props) {
  const { category, brand, model } = await params
  if (!isPriceGuideCategorySlug(category)) notFound()
  const page = await getCachedPriceGuideModel(category, brand, model)
  if (!page) notFound()
  return <PriceGuideModelView page={page} />
}
