import { notFound, permanentRedirect } from "next/navigation"
import { getCachedTopCitiesDirectory } from "@/lib/cache/top-cities-directory"
import { cityLandingHref, findCityByLandingSlug } from "@/lib/city-landing-path"

export const revalidate = 3600

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  try {
    const directory = await getCachedTopCitiesDirectory()
    return directory.cities.map((city) => ({ slug: city.slug }))
  } catch (error) {
    console.warn("[city alias static params] Falling back to on-demand generation", error)
    return []
  }
}

/** `/cities/{slug}` aliases the dedicated city landing page at `/reswell/{slug}`. */
export default async function CitySlugAliasPage({ params }: Props) {
  const { slug } = await params
  const directory = await getCachedTopCitiesDirectory()
  const city = findCityByLandingSlug(directory.cities, slug)
  if (!city) notFound()
  permanentRedirect(cityLandingHref(city.slug))
}
