import Script from "next/script"
import type { ReactNode } from "react"

export default function ShopifyEmbeddedAppLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <>
      <Script
        src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
        strategy="beforeInteractive"
      />
      {children}
    </>
  )
}
