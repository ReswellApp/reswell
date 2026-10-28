"use server"

import {
  loadLocalPickupNearMePreferenceForUser,
  saveLocalPickupNearMePreference,
  type LocalPickupNearMePreferenceState,
  type SaveLocalPickupNearMePreferenceResult,
} from "@/lib/services/localPickupNearMePreference"
import { createClient } from "@/lib/supabase/server"

export async function getLocalPickupNearMePreferenceState(): Promise<
  { error: string } | LocalPickupNearMePreferenceState
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  return loadLocalPickupNearMePreferenceForUser(user.id)
}

export async function saveLocalPickupNearMePreferenceAction(
  input: unknown,
): Promise<SaveLocalPickupNearMePreferenceResult> {
  return saveLocalPickupNearMePreference(input)
}
