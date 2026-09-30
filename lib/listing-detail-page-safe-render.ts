import type { ReactNode } from "react"
import type { ListingDetailPageSharedProps } from "@/lib/listing-detail-page-load"

function isNextControlFlowError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("digest" in error)) return false
  const digest = (error as { digest?: unknown }).digest
  return typeof digest === "string" && digest.startsWith("NEXT_")
}

/**
 * Signed-in `/l` extras (owner tools, favorites, recently viewed) must never
 * take down the public PDP. On throw, log the server error and rerender as the
 * guest catalog view.
 */
export async function renderListingDetailWithGuestFallback(
  props: ListingDetailPageSharedProps,
  render: (props: ListingDetailPageSharedProps) => Promise<ReactNode>,
): Promise<ReactNode> {
  try {
    return await render(props)
  } catch (error) {
    if (isNextControlFlowError(error)) throw error
    console.error("[listing-detail] signed-in PDP render failed", {
      listingParam: props.listingParam,
      anonymousPublicView: Boolean(props.anonymousPublicView),
      message: error instanceof Error ? error.message : String(error),
    })
    if (!props.anonymousPublicView && props.prefetchedListing) {
      return render({
        listingParam: props.listingParam,
        prefetchedListing: props.prefetchedListing,
        anonymousPublicView: true,
        viewerUser: null,
      })
    }
    throw error
  }
}
