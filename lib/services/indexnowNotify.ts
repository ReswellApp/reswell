import { after } from "next/server"
import { listingDetailHref } from "@/lib/listing-href"
import { absoluteUrl } from "@/lib/site-metadata"
import { buildIndexNowSubmission, readIndexNowKey } from "@/lib/seo/indexnow"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

const INDEXNOW_VISIBLE_STATUSES = new Set(["active", "sold", "pending_sale"])

/**
 * Ask Bing to recrawl a public listing URL after publish, sale, or another
 * visible change. No-ops until INDEXNOW_KEY is set. Never throws.
 */
export function notifyIndexNowOfListingBestEffort(listingId: string): void {
  const key = readIndexNowKey(process.env.INDEXNOW_KEY)
  if (!key || !listingId.trim()) return

  const run = async () => {
    try {
      const supabase = createServiceRoleClient()
      const { data, error } = await supabase
        .from("listings")
        .select("id, slug, status, hidden_from_site, archived_at")
        .eq("id", listingId)
        .maybeSingle()

      if (error || !data?.id) return
      if (data.hidden_from_site || data.archived_at) return
      if (!INDEXNOW_VISIBLE_STATUSES.has(String(data.status ?? ""))) return

      const url = absoluteUrl(listingDetailHref({ id: data.id, slug: data.slug }))
      const submission = buildIndexNowSubmission({
        origin: publicSiteOrigin(),
        key,
        urls: [url],
      })
      if (!submission) return

      const response = await fetch(submission.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(submission.body),
      })
      if (!response.ok) {
        console.error("[indexnow] submit failed", {
          listingId,
          status: response.status,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error("[indexnow] submit threw", {
        listingId,
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  try {
    after(run)
  } catch {
    void run()
  }
}
