import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { SurfShopLandingView } from "@/components/features/surf-shops/surf-shop-landing-view"
import {
  CITY_SURF_SHOPS,
  findSurfShopBySlug,
  surfShopHref,
  surfShopLocationLabel,
} from "@/lib/city-landing-surf-shops"
import { resolveDynamicSeo } from "@/lib/seo/resolve-dynamic-seo"
import { absoluteUrl } from "@/lib/site-metadata"

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return CITY_SURF_SHOPS.map((shop) => ({ slug: shop.slug }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = findSurfShopBySlug(slug)
  if (!shop) {
    return { title: "Surf shop — Reswell" }
  }

  const location = surfShopLocationLabel(shop)
  const fallbackTitle = `${shop.name} — Reswell`
  const fallbackDescription =
    shop.description?.trim() || `${shop.name} in ${location}. Independent surf shop featured on Reswell.`
  const seo = await resolveDynamicSeo(
    "type:surf-shop",
    { name: shop.name, location },
    { title: fallbackTitle, description: fallbackDescription },
  )
  const path = surfShopHref(shop.slug)
  const url = absoluteUrl(path)
  const image = absoluteUrl(shop.logoSrc)

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: path },
    openGraph: {
      title: shop.name,
      description: seo.description,
      type: "website",
      url,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary",
      title: shop.name,
      description: seo.description,
      images: [image],
    },
  }
}

export default async function SurfShopLandingPage({ params }: Props) {
  const { slug } = await params
  const shop = findSurfShopBySlug(slug)
  if (!shop) notFound()
  if (shop.slug !== slug) {
    permanentRedirect(surfShopHref(shop.slug))
  }

  return <SurfShopLandingView shop={shop} />
}
