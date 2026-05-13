import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Purchase confirmed — Reswell",
  description: "Your checkout completed successfully. View purchase details and next steps in your dashboard.",
  path: "/checkout/success",
})

export default function CheckoutSuccessLayout({ children }: { children: ReactNode }) {
  return children
}
