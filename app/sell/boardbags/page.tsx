import type { Metadata } from "next"
import SellBoardbagsFlow from "./sell-boardbags-client"

const title = "Sell your boardbag — Reswell"
const description =
  "List your boardbag on Reswell in minutes: add photos, pick the size, set your price, and choose shipping or local pickup."

export const metadata: Metadata = {
  title,
  description,
  keywords: ["sell boardbag", "list boardbag", "used boardbag", "Rip Curl boardbag", "O'Neill boardbag", "Reswell"],
  alternates: { canonical: "/sell/boardbags" },
  openGraph: {
    title,
    description,
    url: "/sell/boardbags",
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

export default async function SellBoardbagsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>
}) {
  const qs = await searchParams
  const editId = parseEditListingId(qs.edit)
  return <SellBoardbagsFlow editListingId={editId} />
}
