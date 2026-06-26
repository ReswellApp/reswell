import type { Metadata } from "next"
import { Suspense } from "react"
import SellFinsFlow from "./sell-fins-client"

const title = "Sell your fins — Reswell"
const description =
  "List your surfboard fins on Reswell in minutes: add photos, pick the setup and system, set your price, and ship to buyers nationwide."

export const metadata: Metadata = {
  title,
  description,
  keywords: ["sell fins", "list surfboard fins", "used fins", "FCS fins", "Futures fins", "Reswell"],
  alternates: { canonical: "/sell/fins" },
  openGraph: {
    title,
    description,
    url: "/sell/fins",
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

export default async function SellFinsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>
}) {
  const qs = await searchParams
  const editId = parseEditListingId(qs.edit)
  return (
    <Suspense fallback={null}>
      <SellFinsFlow editListingId={editId} />
    </Suspense>
  )
}
