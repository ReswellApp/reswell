import type { MobileShipper } from "@reswell/api-contract"
import { canSetCoastalStatus } from "@/lib/services/coastalAddressSnapshot"
import type { CoastalDeliveryStatus } from "@/lib/types/coastal-delivery"

const SHIPPER_ACTION_LABEL: Record<CoastalDeliveryStatus, string> = {
  waiting_for_run: "Mark waiting",
  picked_up: "Pick up",
  dropped_off: "Drop off",
  cancelled: "Cancel",
}

export function supportStatusLabel(status: string): string {
  if (status === "resolved") return "Resolved"
  if (status === "waiting_on_you") return "Waiting on you"
  if (status === "in_progress") return "In progress"
  if (status === "in_review") return "In review"
  if (status === "submitted") return "Submitted"
  return "Open"
}

export function shipperJobActions(
  status: CoastalDeliveryStatus,
  enabled: boolean,
): MobileShipper["jobs"][number]["actions"] {
  if (!enabled) return []
  return (["waiting_for_run", "picked_up", "dropped_off", "cancelled"] as const)
    .filter((next) => canSetCoastalStatus(status, next))
    .map((next) => ({ status: next, label: SHIPPER_ACTION_LABEL[next] }))
}
