import { Plane } from "lucide-react"

import { AIR_CARGO_PICKUP_WITHIN_HOURS } from "@/lib/shipping/air-cargo"
import { cn } from "@/lib/utils"

interface AirCargoPickupNoticeProps {
  airport: string
  audience: "buyer" | "seller"
  pickupWithinHours?: number
  className?: string
}

export function AirCargoPickupNotice({
  airport,
  audience,
  pickupWithinHours = AIR_CARGO_PICKUP_WITHIN_HOURS,
  className,
}: AirCargoPickupNoticeProps) {
  const hours = pickupWithinHours
  return (
    <div
      className={cn(
        "rounded-[8px] border border-[#5574AD]/30 bg-[#5574AD]/[0.06] px-4 py-3.5 text-[13px] leading-relaxed text-neutral-700",
        className,
      )}
    >
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <Plane className="h-4 w-4 shrink-0 text-[#5574AD]" aria-hidden />
        Air cargo to {airport}
      </p>
      {audience === "buyer" ? (
        <p className="mt-1.5">
          Pick the board up at the cargo office within {hours} hours of landing. The office calls when it is
          ready, and the air waybill number shows up here once it ships. Reswell does not cover storage fees
          if pickup is late.
        </p>
      ) : (
        <p className="mt-1.5">
          No parcel label is created for this order. Ship the board to {airport} cargo. The buyer must pick it
          up within {hours} hours of landing. When it ships, add the air waybill as the tracking number below.
        </p>
      )}
    </div>
  )
}
