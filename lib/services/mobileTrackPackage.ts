import { mobileTrackPackageParamSchema, type MobileTrackPackage } from "@reswell/api-contract"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { toMobileTrackPackage } from "@/lib/services/mobileTrackPackageMap"
import { getPublicOrderTrackingPage } from "@/lib/services/publicOrderTracking"

export async function getMobileTrackPackage(
  orderId: string,
): Promise<MobileApiResult<MobileTrackPackage>> {
  const parsed = mobileTrackPackageParamSchema.safeParse({ id: orderId.trim() })
  if (!parsed.success) return { ok: false, status: 400, error: "Invalid order" }

  const page = await getPublicOrderTrackingPage(parsed.data.id)
  if (!page) return { ok: false, status: 404, error: "Tracking is not available" }

  return { ok: true, data: toMobileTrackPackage(page) }
}
