import type { Metadata } from "next"
import SellAccessoriesFlow from "./sell-accessories-client"

const title = "Sell your accessory — Reswell"
const description =
  "List your accessory on Reswell in minutes: add photos, pick the size, set your price, and choose shipping or local pickup."

export const metadata: Metadata = {
  title,
  description,
  keywords: ["sell accessory", "list accessory", "used accessory", "Rip Curl accessory", "O'Neill accessory", "Reswell"],
  alternates: { canonical: "/sell/accessories" },
  openGraph: {
    title,
    description,
    url: "/sell/accessories",
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

export default async function SellAccessoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>
}) {
  const qs = await searchParams
  const editId = parseEditListingId(qs.edit)
  return <SellAccessoriesFlow editListingId={editId} />
}
