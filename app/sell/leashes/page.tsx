import type { Metadata } from "next"
import SellLeashesFlow from "./sell-leashes-client"

const title = "Sell your leash — Reswell"
const description =
  "List your leash on Reswell in minutes: add photos, pick the size, set your price, and choose shipping or local pickup."

export const metadata: Metadata = {
  title,
  description,
  keywords: ["sell leash", "list leash", "used leash", "Rip Curl leash", "O'Neill leash", "Reswell"],
  alternates: { canonical: "/sell/leashes" },
  openGraph: {
    title,
    description,
    url: "/sell/leashes",
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

export default async function SellLeashesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>
}) {
  const qs = await searchParams
  const editId = parseEditListingId(qs.edit)
  return <SellLeashesFlow editListingId={editId} />
}
