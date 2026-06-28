import { toast } from "sonner"

type RouterLike = {
  push: (href: string) => void
}
import type { ImpersonationData } from "@/lib/impersonation"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { resolveAdminBulkListingAfterCreate } from "@/lib/utils/admin-bulk-listing-navigation"
import {
  createImpersonatedListingViaApi,
  listingImagesToImpersonatedPayload,
} from "@/lib/utils/admin-impersonated-listing-create"

type DirectCreateResult =
  | { success: true; listingId: string; slug: string }
  | { error: string }

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
}): Promise<void> {
  if (params.listingImpersonation) {
    const impResult = await createImpersonatedListingViaApi({
      listing: params.listingFields,
      images: listingImagesToImpersonatedPayload(params.images),
    })
    if (!impResult.ok) {
      toast.error(impResult.error)
      params.setSubmitting(false)
      return
    }
    toast.success(params.successToast)
    if (
      resolveAdminBulkListingAfterCreate(params.router, {
        bulkSlotId: params.bulkSlotId,
        listingId: impResult.listingId,
        slug: impResult.slug,
        title: params.title,
        section: params.section,
        defaultDetailPath: `/l/${impResult.slug}`,
      })
    ) {
      return
    }
    params.router.push(`/l/${impResult.slug}`)
    return
  }

  const result = await params.directCreate()
  if ("error" in result) {
    toast.error(result.error)
    params.setSubmitting(false)
    return
  }

  toast.success(params.successToast)
  if (
    resolveAdminBulkListingAfterCreate(params.router, {
      bulkSlotId: params.bulkSlotId,
      listingId: result.listingId,
      slug: result.slug,
      title: params.title,
      section: params.section,
      defaultDetailPath: `/l/${result.slug}`,
    })
  ) {
    return
  }
  params.router.push(`/l/${result.slug}`)
}
