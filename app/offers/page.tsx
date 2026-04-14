import { redirect } from "next/navigation"

/**
 * Canonical offers UI lives at /dashboard/offers.
 * This route keeps legacy /bookmarked /offers URLs working without relying only on next.config redirects.
 */
export default async function LegacyOffersRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const q = new URLSearchParams()
  for (const [key, val] of Object.entries(sp)) {
    if (typeof val === "string") {
      q.set(key, val)
    } else if (Array.isArray(val)) {
      for (const v of val) {
        if (typeof v === "string") q.append(key, v)
      }
    }
  }
  const suffix = q.toString()
  redirect(suffix ? `/dashboard/offers?${suffix}` : "/dashboard/offers")
}
