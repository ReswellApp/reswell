import { buildLlmsTxt } from "@/lib/agent/llms-txt"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { getDb } from "@/lib/supabase/db"

export const revalidate = 3600

async function activePublicListingCount(): Promise<number | null> {
  try {
    const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
    const { count, error } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .is("archived_at", null)
    if (error || count == null) return null
    return count
  } catch {
    return null
  }
}

export async function GET() {
  const activeListingCount = await activePublicListingCount()
  const body = buildLlmsTxt(publicSiteOrigin(), { activeListingCount })
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
