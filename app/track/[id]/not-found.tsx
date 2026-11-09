import Link from "next/link"
import type { Metadata } from "next"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Tracking not available — Reswell",
  description: "This tracking page is not available.",
  robots: { index: false, follow: false },
}

export default function PublicOrderTrackingNotFound() {
  return (
    <main className="flex-1 py-16">
      <div className="container mx-auto max-w-xl px-4 text-center">
        <h1 className="font-headline text-2xl font-bold tracking-tight text-foreground">
          Tracking is not available
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This link may be old, or the shipment does not have a tracking number yet.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Back to Reswell</Link>
        </Button>
      </div>
    </main>
  )
}
