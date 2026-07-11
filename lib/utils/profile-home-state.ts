import { toUsStateCode } from "@/lib/utils/us-state-code"

export type ProfileHomeStateInput = {
  default_listing_state?: string | null
  location?: string | null
  state?: string | null
}

export function parseStateFromLocationText(
  location: string | null | undefined,
): string | undefined {
  if (!location?.trim()) return undefined
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length >= 2) {
    return toUsStateCode(parts[parts.length - 1])
  }
  return toUsStateCode(location)
}

/** Best-effort US state for a signed-up profile from saved locality fields. */
export function resolveProfileHomeState(
  profile: ProfileHomeStateInput | null | undefined,
): string | undefined {
  if (!profile) return undefined

  const fromDefault = toUsStateCode(profile.default_listing_state)
  if (fromDefault) return fromDefault

  const fromState = toUsStateCode(profile.state)
  if (fromState) return fromState

  return parseStateFromLocationText(profile.location)
}
