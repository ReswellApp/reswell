import { redirect } from "next/navigation"

/** @deprecated Use `/checkout/success` */
export default function LegacyPeerListingCheckoutSuccessRedirect() {
  redirect("/checkout/success")
}
