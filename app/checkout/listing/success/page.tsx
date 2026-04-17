import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Order confirmed — Reswell",
  description: "Legacy success URL — forwarding to the current order confirmation page.",
  path: "/checkout/listing/success",
})

/** @deprecated Use `/checkout/success` */
export default function LegacyPeerListingCheckoutSuccessRedirect() {
  redirect("/checkout/success")
}
