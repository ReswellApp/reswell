import {
  mobileMarketplaceSalesMapSchema,
  type MobileMarketplaceSalesMap,
} from "@reswell/api-contract"
import { getCachedMarketplaceSalesMap } from "@/lib/cache/marketplace-sales-map"
import type { MobileApiResult } from "@/lib/services/mobileApi"

export async function getMobileMarketplaceSalesMapService(): Promise<
  MobileApiResult<MobileMarketplaceSalesMap>
> {
  try {
    const payload = await getCachedMarketplaceSalesMap()
    const parsed = mobileMarketplaceSalesMapSchema.safeParse(payload)
    if (!parsed.success) {
      console.error("[mobile-api] marketplace sales map shape failed", {
        timestamp: new Date().toISOString(),
        issues: parsed.error.issues.map((issue) => issue.path.join(".")),
      })
      return { ok: false, status: 500, error: "Unable to load the sales map right now" }
    }
    return { ok: true, data: parsed.data }
  } catch (error) {
    console.error("[mobile-api] marketplace sales map failed", {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, status: 500, error: "Unable to load the sales map right now" }
  }
}
