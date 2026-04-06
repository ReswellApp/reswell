import { redirect } from "next/navigation"

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
