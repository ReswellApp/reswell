import { toast } from "sonner"
import { revalidateListingDetailAfterListingMutation } from "@/app/actions/listing-detail-cache"
import type { ImpersonationData } from "@/lib/impersonation"
import { listingDetailHref } from "@/lib/listing-href"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { logSellFunnelEvent } from "@/lib/sell-flow/log-sell-funnel-event"
import { resolveAdminBulkListingAfterCreate } from "@/lib/utils/admin-bulk-listing-navigation"
import {
  createImpersonatedListingViaApi,
  listingImagesToImpersonatedPayload,
} from "@/lib/utils/admin-impersonated-listing-create"

type RouterLike = {
  push: (href: string) => void
  refresh?: () => void
}

type DirectCreateResult =
  | { success: true; listingId: string; slug: string }
  | { error: string }

function peerListingDetailPath(listingId: string, slug: string): string {
  return listingDetailHref({ id: listingId, slug })
}

async function navigateToPublishedListing(
  router: RouterLike,
  listingId: string,
  slug: string,
): Promise<void> {
  void revalidateListingDetailAfterListingMutation({ listingId, slug }).catch((err) => {
    if (process.env.NODE_ENV === "development") {
      console.warn("[sell] listing-detail cache revalidation:", err)
    }
  })
  router.push(peerListingDetailPath(listingId, slug))
  router.refresh?.()
}

/** Shared create + bulk redirect for peer `/sell/*` flows. */
export async function finalizePeerListingCreate(params: {
  listingImpersonation: ImpersonationData | null
  listingFields: Record<string, unknown>
  images: { url: string; thumbnailUrl?: string | null }[]
  title: string
  section: PeerListingSection
  bulkSlotId: string | null
  router: RouterLike
  directCreate: () => Promise<DirectCreateResult>
  successToast: string
  setSubmitting: (value: boolean) => void
  /** When set, publish outcome funnel events include elapsed time from this timestamp. */
  publishStartedAt?: number
}): Promise<void> {
  const funnelDurationMs = () =>
    params.publishStartedAt != null ? Date.now() - params.publishStartedAt : undefined

  if (params.listingImpersonation) {
    const impResult = await createImpersonatedListingViaApi({
      listing: params.listingFields,
      images: listingImagesToImpersonatedPayload(params.images),
    })
    if (!impResult.ok) {
      logSellFunnelEvent({
        listingType: params.section,
        event: "publish_failed",
        message: impResult.error,
        durationMs: funnelDurationMs(),
      })
      toast.error(impResult.error)
      params.setSubmitting(false)
      return
    }
    logSellFunnelEvent({
      listingType: params.section,
      event: "publish_succeeded",
      listingId: impResult.listingId,
      durationMs: funnelDurationMs(),
    })
    toast.success(params.successToast)
    if (
      resolveAdminBulkListingAfterCreate(params.router, {
        bulkSlotId: params.bulkSlotId,
        listingId: impResult.listingId,
        slug: impResult.slug,
        title: params.title,
        section: params.section,
        defaultDetailPath: peerListingDetailPath(impResult.listingId, impResult.slug),
      })
    ) {
      return
    }
    await navigateToPublishedListing(params.router, impResult.listingId, impResult.slug)
    return
  }

  const result = await params.directCreate()
  if ("error" in result) {
    logSellFunnelEvent({
      listingType: params.section,
      event: "publish_failed",
      message: result.error,
      durationMs: funnelDurationMs(),
    })
    toast.error(result.error)
    params.setSubmitting(false)
    return
  }

  logSellFunnelEvent({
    listingType: params.section,
    event: "publish_succeeded",
    listingId: result.listingId,
    durationMs: funnelDurationMs(),
  })
  toast.success(params.successToast)
  if (
    resolveAdminBulkListingAfterCreate(params.router, {
      bulkSlotId: params.bulkSlotId,
      listingId: result.listingId,
      slug: result.slug,
      title: params.title,
      section: params.section,
      defaultDetailPath: peerListingDetailPath(result.listingId, result.slug),
    })
  ) {
    return
  }
  await navigateToPublishedListing(params.router, result.listingId, result.slug)
}
