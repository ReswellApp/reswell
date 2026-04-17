import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Order confirmed — Reswell",
  description: "Your checkout completed successfully. View order details and next steps in your dashboard.",
  path: "/checkout/success",
})

export default function CheckoutSuccessLayout({ children }: { children: ReactNode }) {
  return children
}
