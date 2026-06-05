import type { Metadata } from "next"
import SellSurfpacksFlow from "./sell-surfpacks-client"

const title = "Sell your surfpack — Reswell"
const description =
  "List your surfpack on Reswell in minutes: add photos, pick the size, set your price, and choose shipping or local pickup."

export const metadata: Metadata = {
  title,
  description,
  keywords: ["sell surfpack", "list surfpack", "used surfpack", "Rip Curl surfpack", "O'Neill surfpack", "Reswell"],
  alternates: { canonical: "/sell/surfpacks" },
  openGraph: {
    title,
    description,
    url: "/sell/surfpacks",
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

export default async function SellSurfpacksPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>
}) {
  const qs = await searchParams
  const editId = parseEditListingId(qs.edit)
  return <SellSurfpacksFlow editListingId={editId} />
}
