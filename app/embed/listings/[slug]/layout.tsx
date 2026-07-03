import type { Metadata } from "next"

import { GoogleAnalyticsGtag } from "@/components/google-analytics-gtag"

export const metadata: Metadata = {
  title: "Reswell listings",
  robots: { index: false, follow: false },
}

export default function PartnerListingEmbedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <GoogleAnalyticsGtag />
      <div className="min-h-0 overflow-hidden bg-transparent">{children}</div>
    </>
  )
}
