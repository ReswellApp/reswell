import type { Metadata } from "next"
import SellWetsuitsFlow from "./sell-wetsuits-client"

const title = "Sell your wetsuit — Reswell"
const description =
  "List your wetsuit on Reswell in minutes: add photos, pick the size, set your price, and choose shipping or local pickup."

export const metadata: Metadata = {
  title,
  description,
  keywords: ["sell wetsuit", "list wetsuit", "used wetsuit", "Rip Curl wetsuit", "O'Neill wetsuit", "Reswell"],
  alternates: { canonical: "/sell/wetsuits" },
  openGraph: {
    title,
    description,
    url: "/sell/wetsuits",
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

export default async function SellWetsuitsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>
}) {
  const qs = await searchParams
  const editId = parseEditListingId(qs.edit)
  return <SellWetsuitsFlow editListingId={editId} />
}
