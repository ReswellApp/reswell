import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "PayPal — Reswell",
  description: "Completing PayPal connection for Reswell payouts. You can close this window when prompted.",
  path: "/auth/paypal/popup-close",
})

export default function PayPalPopupCloseLayout({ children }: { children: ReactNode }) {
  return children
}
