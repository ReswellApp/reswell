import { Suspense } from "react"
import type { Metadata } from "next"
import QuickListClient from "./quick-list-client"

export const metadata: Metadata = {
  title: "Quick List | Reswell",
  description:
    "List your surfboard in seconds — add a photo, title, description, price, and choose pickup or shipping.",
  alternates: { canonical: "/sell/quick" },
}

/**
 * Quick List — photo-first, single-screen surfboard listing.
 * Brand-new listings only; editing stays with the full wizard (`/sell/boards?edit=`).
 */
export default function QuickListPage() {
  return (
    <Suspense fallback={null}>
      <QuickListClient />
    </Suspense>
  )
}
