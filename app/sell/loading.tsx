import { SellTypeChooserSkeleton } from "@/components/features/sell/sell-flow-route-skeleton"

/** Instant loading UI for `/sell` — matches the type chooser, not the listing editor. */
export default function SellRouteLoading() {
  return <SellTypeChooserSkeleton />
}
