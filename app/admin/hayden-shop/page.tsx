import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { HaydenShopInstagramClient } from "@/components/features/admin/hayden-shop/hayden-shop-instagram-client"

export const metadata = privatePageMetadata({
  title: "Hayden's Shop — Admin — Reswell",
  description:
    "Build an Instagram post from a Hayden's Shop listing: download every photo and copy the details and description.",
  path: "/admin/hayden-shop",
})

function InstagramFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
    </div>
  )
}

export default function AdminHaydenShopPage() {
  return (
    <Suspense fallback={<InstagramFallback />}>
      <HaydenShopInstagramClient />
    </Suspense>
  )
}
