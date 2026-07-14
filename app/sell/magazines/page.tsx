import { Suspense } from "react"
import type { Metadata } from "next"
import SellMagazinesFlow from "./sell-magazines-client"

const title = "Sell your magazines — Reswell"
const description =
  "List vintage and collectible surf magazines on Reswell in minutes: add photos, set your price, and ship to buyers nationwide."

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "sell magazines",
    "list surf magazines",
    "used surf magazines",
    "vintage surf magazines",
    "Surfer's Journal",
    "Reswell",
  ],
  alternates: { canonical: "/sell/magazines" },
  openGraph: {
    title,
    description,
    url: "/sell/magazines",
    siteName: "Reswell",
    locale: "en_US",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
}

function parseEditListingId(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === "string" && first.trim()) return first.trim()
  }
  return null
}

export default async function SellMagazinesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>
}) {
  const qs = await searchParams
  const editId = parseEditListingId(qs.edit)
  return (
    <Suspense fallback={null}>
      <SellMagazinesFlow editListingId={editId} />
    </Suspense>
  )
}
