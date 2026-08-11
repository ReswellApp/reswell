import { toast } from "sonner"
import { revalidateListingDetailAfterListingMutation } from "@/app/actions/listing-detail-cache"
import type { ImpersonationData } from "@/lib/impersonation"
import { listingDetailHref } from "@/lib/listing-href"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { setJustPublishedListingMarker } from "@/lib/sell-flow/just-published"
import { logSellFunnelEvent } from "@/lib/sell-flow/log-sell-funnel-event"
import { sellActionErrorMessage } from "@/lib/sell-flow/sell-submit-error"
import { resolveAdminBulkListingAfterCreate } from "@/lib/utils/admin-bulk-listing-navigation"
import {
  createImpersonatedListingViaApi,
  listingImagesToImpersonatedPayload,
  listingVideosToImpersonatedPayload,
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
  videos?: Array<{
    url: string
    thumbnailUrl?: string | null
    contentType?: string | null
    durationSeconds?: number | null
    byteSize?: number | null
    sortOrder?: number
  }>
  title: string
  section: PeerListingSection
  bulkSlotId: string | null
  router: RouterLike
  directCreate: () => Promise<DirectCreateResult>
  successToast: string
  setSubmitting: (value: boolean) => void
  /** Runs after a successful create, before navigation (e.g. clear local draft stash). */
  onCreateSuccess?: (created: { listingId: string; slug: string }) => void | Promise<void>
  /** When set, publish outcome funnel events include elapsed time from this timestamp. */
  publishStartedAt?: number
}): Promise<void> {
  const funnelDurationMs = () =>
    params.publishStartedAt != null ? Date.now() - params.publishStartedAt : undefined

  if (params.listingImpersonation) {
    const impResult = await createImpersonatedListingViaApi({
      listing: params.listingFields,
      images: listingImagesToImpersonatedPayload(params.images),
      videos: listingVideosToImpersonatedPayload(params.videos ?? []),
    })
    if (!impResult.ok) {
      const message = sellActionErrorMessage(impResult.error)
      logSellFunnelEvent({
        listingType: params.section,
        event: "publish_failed",
        message,
        durationMs: funnelDurationMs(),
      })
      toast.error(message)
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
    await params.onCreateSuccess?.({ listingId: impResult.listingId, slug: impResult.slug })
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
    const message = sellActionErrorMessage(result.error)
    logSellFunnelEvent({
      listingType: params.section,
      event: "publish_failed",
      message,
      durationMs: funnelDurationMs(),
    })
    toast.error(message)
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
  await params.onCreateSuccess?.({ listingId: result.listingId, slug: result.slug })
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
  // Seller's own fresh publish — hand off the PDP "listing is live" celebration.
  setJustPublishedListingMarker({
    listingId: result.listingId,
    slug: result.slug,
    section: params.section,
  })
  await navigateToPublishedListing(params.router, result.listingId, result.slug)
}
