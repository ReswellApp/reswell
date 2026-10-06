import type { CoastalShipperProfileView } from "@/lib/types/coastal-delivery"

export function shipperAccountLine(profile: Pick<CoastalShipperProfileView, "email" | "isShop">): string {
  const email = profile.email?.trim() || "No email on this account"
  return profile.isShop ? `${email} · Shop` : email
}

/** One line. Schedule off, schedule on, and runs on are not three boxes. */
export function shipperWeekStatusLine(profile: {
  scheduleEnabled: boolean
  runs: readonly { enabled: boolean }[]
}): string {
  if (!profile.scheduleEnabled) return "Shipper is off."
  const on = profile.runs.filter((run) => run.enabled).length
  if (on === 0) return "Shipper is on."
  return on === 1 ? "Shipper is on. One run can take boards." : `Shipper is on. ${on} runs can take boards.`
}
