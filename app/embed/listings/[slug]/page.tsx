import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { fetchPartnerEmbedPublicService } from "@/lib/services/partnerListingEmbeds"
import { PartnerListingEmbedFrame } from "@/components/features/embed/partner-listing-embed-frame"

export const revalidate = 300

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function PartnerListingEmbedPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()
  const siteOrigin = publicSiteOrigin()

  const result = await fetchPartnerEmbedPublicService(supabase, slug, siteOrigin)
  if (!result.ok) notFound()

  return <PartnerListingEmbedFrame payload={result.payload} slug={slug} origin={siteOrigin} />
}
