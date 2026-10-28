import { revalidateTag } from "next/cache"
import { localPickupNearMePreferenceTag } from "@/lib/cache/local-pickup-near-me-preference"

export function revalidateLocalPickupNearMePreference(userId: string): void {
  const id = userId.trim()
  if (!id) return
  revalidateTag(localPickupNearMePreferenceTag(id), "max")
}
