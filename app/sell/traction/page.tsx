import type { Metadata } from "next"
import SellTractionFlow from "./sell-traction-client"

const title = "Sell your traction — Reswell"
const description =
  "List traction pads on Reswell in minutes: add photos, pick the type, set your price, and choose shipping or local pickup."

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "sell traction",
    "list traction pad",
    "used tail pad",
    "Creatures traction",
    "Dakine traction",
    "Reswell",
  ],
  alternates: { canonical: "/sell/traction" },
  openGraph: {
    title,
    description,
    url: "/sell/traction",
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

export default async function SellTractionPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>
}) {
  const qs = await searchParams
  const editId = parseEditListingId(qs.edit)
  return <SellTractionFlow editListingId={editId} />
}
