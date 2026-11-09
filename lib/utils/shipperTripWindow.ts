import { addIsoDays } from "@/lib/services/coastalShipperWeek"
import { COASTAL_WEEKDAY_LABELS } from "@/lib/types/coastal-delivery"

export type ShipperTripWindow = {
  pickupStart: number
  pickupEnd: number
  deliveryStart: number
  deliveryEnd: number
}

export type ShipperTripWindowRun = {
  dayOfWeek: number
  pickupStartDow?: number | null
  pickupEndDow?: number | null
  deliveryStartDow?: number | null
  deliveryEndDow?: number | null
}

const DESCRIPTION_MIN = 2
const DESCRIPTION_MAX = 160

function validDow(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 6) return null
  return value
}

export function shipperTripWindowError(window: ShipperTripWindow): string | null {
  if (
    validDow(window.pickupStart) == null ||
    validDow(window.pickupEnd) == null ||
    validDow(window.deliveryStart) == null ||
    validDow(window.deliveryEnd) == null
  ) {
    return "Choose days in the week."
  }
  if (window.pickupEnd < window.pickupStart) return "Pickup ends on or after it starts."
  if (window.deliveryStart < window.pickupStart) return "Delivery starts on or after the pickup start."
  if (window.deliveryEnd < window.deliveryStart) return "Delivery ends on or after it starts."
  return null
}

export function shipperTripDescriptionError(pickup: string, delivery: string): string | null {
  const pickupText = pickup.trim()
  const deliveryText = delivery.trim()
  if (pickupText.length < DESCRIPTION_MIN || pickupText.length > DESCRIPTION_MAX) {
    return "Write a short pickup description."
  }
  if (deliveryText.length < DESCRIPTION_MIN || deliveryText.length > DESCRIPTION_MAX) {
    return "Write a short delivery description."
  }
  return null
}

/** Keep a window inside Sunday–Saturday when an earlier day moves. */
export function clampShipperTripWindow(window: ShipperTripWindow): ShipperTripWindow {
  const pickupStart = validDow(window.pickupStart) ?? 0
  const pickupEnd = Math.max(validDow(window.pickupEnd) ?? pickupStart, pickupStart)
  const deliveryStart = Math.max(validDow(window.deliveryStart) ?? pickupStart, pickupStart)
  const deliveryEnd = Math.max(validDow(window.deliveryEnd) ?? deliveryStart, deliveryStart)
  return { pickupStart, pickupEnd, deliveryStart, deliveryEnd }
}

export function tripWindowFromRun(run: ShipperTripWindowRun): ShipperTripWindow {
  const pickupStart = validDow(run.pickupStartDow) ?? validDow(run.dayOfWeek) ?? 0
  return clampShipperTripWindow({
    pickupStart,
    pickupEnd: validDow(run.pickupEndDow) ?? pickupStart,
    deliveryStart: validDow(run.deliveryStartDow) ?? pickupStart,
    deliveryEnd: validDow(run.deliveryEndDow) ?? validDow(run.deliveryStartDow) ?? pickupStart,
  })
}

export function weekdaySpanLabel(start: number, end: number): string {
  const from = COASTAL_WEEKDAY_LABELS[start] ?? "Day"
  const to = COASTAL_WEEKDAY_LABELS[end] ?? "Day"
  if (start === end) return from
  return `${from}–${to}`
}

export function tripWindowSummary(run: ShipperTripWindowRun): string {
  const window = tripWindowFromRun(run)
  const pickup = weekdaySpanLabel(window.pickupStart, window.pickupEnd)
  const delivery = weekdaySpanLabel(window.deliveryStart, window.deliveryEnd)
  if (pickup === delivery) return pickup
  return `Pickup ${pickup} · Delivery ${delivery}`
}

export type TripDayRole = "pickup" | "delivery" | "both"

export function tripDayRole(run: ShipperTripWindowRun, day: number): TripDayRole | null {
  const window = tripWindowFromRun(run)
  const pickup = day >= window.pickupStart && day <= window.pickupEnd
  const delivery = day >= window.deliveryStart && day <= window.deliveryEnd
  if (pickup && delivery) return "both"
  if (pickup) return "pickup"
  if (delivery) return "delivery"
  return null
}

export function tripCoversWeekday(run: ShipperTripWindowRun, day: number): boolean {
  return tripDayRole(run, day) != null
}

export function deliveryDatesForPickup(
  pickupDate: string,
  run: ShipperTripWindowRun,
): { startDate: string; endDate: string; label: string } {
  const window = tripWindowFromRun(run)
  return {
    startDate: addIsoDays(pickupDate, window.deliveryStart - window.pickupStart),
    endDate: addIsoDays(pickupDate, window.deliveryEnd - window.pickupStart),
    label: weekdaySpanLabel(window.deliveryStart, window.deliveryEnd),
  }
}
