"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  shopifyBodyClass,
  shopifyPrimaryButtonClass,
  shopifySectionTitleClass,
  shopifySurfaceClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"

interface PublishListing {
  id: string
  title: string
  price: number
  published: boolean
}

export function ShopifyReswellPublishPanel() {
  const [listings, setListings] = useState<PublishListing[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch("/api/integrations/shopify/reswell-listings")
        const body = (await response.json()) as {
          error?: string
          data?: { listings: PublishListing[] }
        }
        if (!response.ok) {
          if (!cancelled) toast.error(body.error || "Could not load Reswell listings")
          return
        }
        if (!cancelled) setListings(body.data?.listings ?? [])
      } catch {
        if (!cancelled) toast.error("Could not load Reswell listings")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function publish(listingId: string) {
    setBusyId(listingId)
    try {
      const response = await fetch("/api/integrations/shopify/reswell-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        toast.error(body.error || "Could not publish this listing")
        return
      }
      setListings((current) =>
        current.map((listing) =>
          listing.id === listingId ? { ...listing, published: true } : listing,
        ),
      )
      toast.success("Listing published to Shopify")
    } catch {
      toast.error("Could not publish this listing")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className={shopifySurfaceClass}>
      <div className="border-b border-[#e3e3e3] px-5 py-4 dark:border-border">
        <h2 className={shopifySectionTitleClass}>Publish Reswell listings</h2>
        <p className={`mt-1 ${shopifyBodyClass}`}>
          Choose active Reswell listings to publish on Shopify. Shopify edits do not rewrite those listings.
        </p>
      </div>
      <div className="divide-y divide-[#e3e3e3] dark:divide-border">
        {loading ? (
          <p className={`px-5 py-4 ${shopifyBodyClass}`}>Loading listings…</p>
        ) : listings.length === 0 ? (
          <p className={`px-5 py-4 ${shopifyBodyClass}`}>No active Reswell listings to publish.</p>
        ) : (
          listings.map((listing) => (
            <div key={listing.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[#202223] dark:text-foreground">
                  {listing.title}
                </p>
                <p className={shopifyBodyClass}>${listing.price.toFixed(2)}</p>
              </div>
              <Button
                type="button"
                className={shopifyPrimaryButtonClass}
                disabled={listing.published || busyId === listing.id}
                onClick={() => void publish(listing.id)}
              >
                {busyId === listing.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                {listing.published ? "Published" : "Publish"}
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
