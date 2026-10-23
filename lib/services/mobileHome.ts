import { mobileHomeSchema, type MobileHome } from "@reswell/api-contract"
import { getHomeFeed } from "@/lib/services/homeFeed"
import { mobileSectionsFromHomeFeed } from "@/lib/services/mobileHomeMap"
import type { MobileApiResult } from "@/lib/services/mobileApi"

/**
 * Mobile homepage. Membership, order, and titles come from `getHomeFeed()`.
 * The app only lays out the sections this returns.
 */
export async function getMobileHomeService(): Promise<MobileApiResult<MobileHome>> {
  const feed = await getHomeFeed()
  const parsed = mobileHomeSchema.safeParse({ sections: mobileSectionsFromHomeFeed(feed.sections) })
  if (!parsed.success) {
    console.error("[mobile-api] home shape failed", {
      timestamp: new Date().toISOString(),
      issues: parsed.error.issues.map((issue) => issue.path.join(".")),
    })
    return { ok: false, status: 500, error: "Unable to load the homepage right now" }
  }
  if (parsed.data.sections.length === 0) {
    return { ok: false, status: 500, error: "Unable to load the homepage right now" }
  }
  return { ok: true, data: parsed.data }
}
