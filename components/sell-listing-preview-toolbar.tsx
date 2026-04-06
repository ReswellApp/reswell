"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export function SellListingPreviewToolbar({ listingId }: { listingId: string }) {
  const router = useRouter()
  const [publishing, setPublishing] = useState(false)

  async function publish() {
    setPublishing(true)
    try {
      const res = await fetch("/api/listings/publish-draft", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        listingDetailHref?: string
      }
      if (!res.ok) {
        toast.error(data.error || "Could not publish listing")
        return
      }
      if (data.listingDetailHref) {
        toast.success("Your listing is live!")
        router.push(data.listingDetailHref)
        return
      }
      toast.error("Unexpected response from server")
    } catch {
      toast.error("Network error — try again")
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="sticky top-0 z-50 border-b border-border bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Draft preview</span>
          {" — "}
          Buyers don&apos;t see this until you publish.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href={`/sell?draft=${listingId}`}>Edit listing</Link>
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={publishing}
            onClick={() => void publish()}
          >
            {publishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publishing…
              </>
            ) : (
              "Publish listing"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
