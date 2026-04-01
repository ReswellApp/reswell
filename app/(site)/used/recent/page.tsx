import { permanentRedirect } from "next/navigation"

/** Canonical feed lives at `/feed` (new listings + recently sold). */
export default async function LegacyRecentUsedPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const q = new URLSearchParams()
  if (sp) {
    for (const [k, v] of Object.entries(sp)) {
      if (v === undefined) continue
      if (Array.isArray(v)) v.forEach((x) => q.append(k, x))
      else q.set(k, v)
    }
  }
  const suffix = q.toString()
  permanentRedirect(suffix ? `/feed?${suffix}` : "/feed")
}
