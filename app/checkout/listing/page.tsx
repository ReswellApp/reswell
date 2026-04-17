import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Checkout — Reswell",
  description: "Legacy checkout URL — forwarding to the current checkout experience.",
  path: "/checkout/listing",
})

/** @deprecated Use `/checkout?listing=…` */
export default async function LegacyPeerListingCheckoutRedirect(props: {
  searchParams: Promise<{ listing?: string }>
}) {
  const { listing: listingParam } = await props.searchParams
  if (!listingParam?.trim()) {
    redirect("/gear")
  }
  const params = new URLSearchParams()
  params.set("listing", listingParam.trim())
  redirect(`/checkout?${params.toString()}`)
}
