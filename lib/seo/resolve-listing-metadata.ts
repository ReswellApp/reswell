import "server-only"
import type { Metadata } from "next"
import {
  listingTemplateVars,
  metadataForListingDetail,
  type ListingMetaInput,
} from "@/lib/listing-metadata"
import { resolveDynamicSeo } from "@/lib/seo/resolve-dynamic-seo"

/**
 * Listing detail metadata with the admin `type:listing` template applied on top of the built-in
 * defaults. Falls back to {@link metadataForListingDetail} when no template is configured.
 */
export async function resolveListingDetailMetadata(
  listing: ListingMetaInput,
  options?: { pricePrefix?: string },
): Promise<Metadata> {
  const base = metadataForListingDetail(listing, options)
  const fallbackTitle = typeof base.title === "string" ? base.title : ""
  const fallbackDescription = base.description ?? ""

  const seo = await resolveDynamicSeo(
    "type:listing",
    listingTemplateVars(listing, options),
    { title: fallbackTitle, description: fallbackDescription },
  )

  const robots =
    seo.robotsIndex !== null || seo.robotsFollow !== null
      ? {
          index: seo.robotsIndex ?? true,
          follow: seo.robotsFollow ?? true,
          googleBot: { index: seo.robotsIndex ?? true, follow: seo.robotsFollow ?? true },
        }
      : base.robots

  return {
    ...base,
    title: seo.title,
    description: seo.description,
    robots,
    openGraph: { ...base.openGraph, title: seo.title, description: seo.description },
    twitter: { ...base.twitter, title: seo.title, description: seo.description },
  }
}
