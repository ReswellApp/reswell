import { Suspense } from "react"
import QuickListClient from "./quick-list-client"

/**
 * Quick List — photo-first, single-screen surfboard listing.
 * Brand-new listings only; editing stays with the full wizard (`/sell?edit=`).
 * Suspense fallback is null: the client screen owns its own light states.
 */
export default function QuickListPage() {
  return (
    <Suspense fallback={null}>
      <QuickListClient />
    </Suspense>
  )
}
