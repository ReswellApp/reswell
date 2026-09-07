import { notFound, redirect } from "next/navigation"
import { getGiveawayBySlug, listGiveaways } from "@/lib/giveaways/catalog"
import { parseGiveawayBrandParam } from "@/lib/giveaways/intent-storage"
import { GIVEAWAYS_INDEX_HREF } from "@/lib/giveaways/paths"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ brand?: string | string[] }>
}

export function generateStaticParams() {
  return listGiveaways().map((giveaway) => ({ slug: giveaway.slug }))
}

export default async function GiveawayDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { brand: brandParam } = await searchParams
  if (!getGiveawayBySlug(slug)) notFound()

  const brand = parseGiveawayBrandParam(
    Array.isArray(brandParam) ? brandParam[0] : brandParam,
  )
  redirect(
    brand ? `${GIVEAWAYS_INDEX_HREF}?brand=${encodeURIComponent(brand)}` : GIVEAWAYS_INDEX_HREF,
  )
}
