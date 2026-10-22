import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Offers — Reswell",
  description: "Review offers you sent and offers others sent you.",
  path: "/dashboard/offers",
})

/** Old messages inbox for offers. The dashboard page is the only offers home. */
export default async function MessagesOffersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") {
      if (value) params.set(key, value)
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item) params.append(key, item)
      }
    }
  }
  const query = params.toString()
  redirect(query ? `/dashboard/offers?${query}` : "/dashboard/offers")
}
