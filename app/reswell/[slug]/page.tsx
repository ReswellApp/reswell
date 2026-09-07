import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { CityLandingPage } from "@/components/features/cities/city-landing-page"
import { getCachedTopCitiesDirectory } from "@/lib/cache/top-cities-directory"
import { cityLandingHref, findCityByLandingSlug } from "@/lib/city-landing-path"
import { getCityLandingPage } from "@/lib/services/cityLanding"
import { resolveDynamicSeo } from "@/lib/seo/resolve-dynamic-seo"
import { absoluteUrl } from "@/lib/site-metadata"

export const revalidate = 3600

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const directory = await getCachedTopCitiesDirectory()
  return directory.cities.map((city) => ({ slug: city.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const directory = await getCachedTopCitiesDirectory()
  const city = findCityByLandingSlug(directory.cities, slug)
  if (!city) {
    return { title: "City — Reswell" }
  }

  const countLabel =
    city.listingCount === 1 ? "1 listing" : `${city.listingCount.toLocaleString()} listings`
  const fallbackTitle = `Used surfboards in ${city.label} — Reswell`
  const fallbackDescription = `Browse ${countLabel} of used surfboards and gear in ${city.label}. Buy local and pick up in person on Reswell.`
  const seo = await resolveDynamicSeo(
    "type:city",
    { city: city.label, count: countLabel },
    { title: fallbackTitle, description: fallbackDescription },
  )
  const path = cityLandingHref(city.slug)
  const url = absoluteUrl(path)
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: path },
    openGraph: {
      title: seo.title,
      description: seo.description,
      type: "website",
      url,
    },
    twitter: {
      card: "summary",
      title: seo.title,
      description: seo.description,
    },
  }
}

export default async function CityLandingRoute({ params }: Props) {
  const { slug } = await params
  const data = await getCityLandingPage(slug)
  if (!data) notFound()
  if (data.city.slug !== slug) {
    permanentRedirect(cityLandingHref(data.city.slug))
  }

  return <CityLandingPage data={data} />
}
