"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { ListingAdminBarSnapshot } from "@/lib/listing-detail-admin-bar"
import { peerListingEditHref } from "@/lib/peer-listing-sections"
import { withAdminListingEditEntry } from "@/lib/utils/admin-listing-edit-entry"

type BusyKey =
  | "edit"
  | "hide"
  | "delete"
  | "status"
  | "publish"
  | "goodDeal"
  | "homepage"
  | "boards"

async function readApiError(res: Response, fallback: string): Promise<string> {
  const json = (await res.json().catch(() => ({}))) as { error?: unknown }
  return typeof json.error === "string" ? json.error : fallback
}

export function useListingDetailAdminBar(listing: ListingAdminBarSnapshot) {
  const router = useRouter()
  const [busy, setBusy] = React.useState<BusyKey | null>(null)

  const run = React.useCallback(
    async (key: BusyKey, work: () => Promise<void>) => {
      setBusy(key)
      try {
        await work()
      } finally {
        setBusy(null)
      }
    },
    [],
  )

  const editListing = React.useCallback(() => {
    void run("edit", async () => {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: listing.userId,
          displayName: listing.sellerDisplayName ?? "Seller",
          email: null,
        }),
      })
      if (!res.ok) {
        toast.error(await readApiError(res, "Could not start admin edit"))
        return
      }
      window.location.href = withAdminListingEditEntry(
        peerListingEditHref(listing.section, listing.id),
      )
    })
  }, [listing.id, listing.section, listing.sellerDisplayName, listing.userId, run])

  const setHiddenFromSite = React.useCallback(
    (hidden: boolean) => {
      void run("hide", async () => {
        const res = await fetch(`/api/admin/listings/${encodeURIComponent(listing.id)}/site-visibility`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hidden_from_site: hidden }),
        })
        if (!res.ok) {
          toast.error(await readApiError(res, "Could not update visibility"))
          return
        }
        toast.success(hidden ? "Hidden from the site" : "Visible on the site again")
        router.refresh()
      })
    },
    [listing.id, router, run],
  )

  const deleteListing = React.useCallback(() => {
    if (!confirm("Permanently delete this listing? This cannot be undone.")) return
    void run("delete", async () => {
      const res = await fetch(`/api/admin/listings?id=${encodeURIComponent(listing.id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        toast.error(await readApiError(res, "Could not delete listing"))
        return
      }
      toast.success("Listing deleted")
      router.push("/admin/listings")
    })
  }, [listing.id, router, run])

  const setStatus = React.useCallback(
    (status: "removed" | "active") => {
      void run("status", async () => {
        const res = await fetch("/api/admin/listings/status", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listing_ids: [listing.id], status }),
        })
        if (!res.ok) {
          toast.error(await readApiError(res, "Could not update listing status"))
          return
        }
        toast.success(status === "removed" ? "Listing removed" : "Listing restored")
        router.refresh()
      })
    },
    [listing.id, router, run],
  )

  const publishDraft = React.useCallback(() => {
    if (
      !confirm(
        `Publish "${listing.title}" live? It needs a price, description, location, and at least one photo.`,
      )
    ) {
      return
    }
    void run("publish", async () => {
      const res = await fetch(`/api/admin/listings/${encodeURIComponent(listing.id)}/publish`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) {
        toast.error(await readApiError(res, "Could not publish draft"))
        return
      }
      toast.success("Draft published")
      router.refresh()
    })
  }, [listing.id, listing.title, router, run])

  const setGoodDeal = React.useCallback(
    (isGoodDeal: boolean) => {
      void run("goodDeal", async () => {
        const res = await fetch(`/api/admin/listings/${encodeURIComponent(listing.id)}/good-deal`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_good_deal: isGoodDeal }),
        })
        if (!res.ok) {
          toast.error(await readApiError(res, "Could not update good deal"))
          return
        }
        toast.success(isGoodDeal ? "Marked as a good deal" : "Good deal removed")
        router.refresh()
      })
    },
    [listing.id, router, run],
  )

  const setHiddenFromHomepage = React.useCallback(
    (hidden: boolean) => {
      void run("homepage", async () => {
        const res = await fetch(
          `/api/admin/listings/${encodeURIComponent(listing.id)}/homepage-visibility`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hidden_from_homepage: hidden }),
          },
        )
        if (!res.ok) {
          toast.error(await readApiError(res, "Could not update homepage visibility"))
          return
        }
        toast.success(hidden ? "Hidden from homepage" : "Shown on homepage again")
        router.refresh()
      })
    },
    [listing.id, router, run],
  )

  const setBoardsSuppressed = React.useCallback(
    (suppressed: boolean) => {
      void run("boards", async () => {
        const res = await fetch(
          `/api/admin/listings/${encodeURIComponent(listing.id)}/boards-browse-suppression`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ suppressed_on_boards_browse: suppressed }),
          },
        )
        if (!res.ok) {
          toast.error(await readApiError(res, "Could not update /boards ranking"))
          return
        }
        toast.success(suppressed ? "Sorted last on /boards" : "Restored on /boards")
        router.refresh()
      })
    },
    [listing.id, router, run],
  )

  return {
    busy,
    editListing,
    setHiddenFromSite,
    deleteListing,
    setStatus,
    publishDraft,
    setGoodDeal,
    setHiddenFromHomepage,
    setBoardsSuppressed,
  }
}
