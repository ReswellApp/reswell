import { revalidateLocalPickupNearMePreference } from "@/lib/cache/revalidate-local-pickup-near-me-preference"
import { getCachedLocalPickupNearMePreferenceForUser } from "@/lib/cache/local-pickup-near-me-preference"
import { createClient } from "@/lib/supabase/server"
import {
  upsertLocalPickupNearMePreferenceForUser,
  type LocalPickupNearMePreference,
} from "@/lib/db/localPickupNearMePreference"
import {
  saveLocalPickupNearMePreferenceSchema,
  type SaveLocalPickupNearMePreferenceInput,
} from "@/lib/validations/localPickupNearMePreference"

export type LocalPickupNearMePreferenceState = LocalPickupNearMePreference

export async function loadLocalPickupNearMePreferenceForUser(
  userId: string,
): Promise<LocalPickupNearMePreferenceState> {
  return getCachedLocalPickupNearMePreferenceForUser(userId)
}

export type SaveLocalPickupNearMePreferenceResult =
  | { ok: true; preference: LocalPickupNearMePreference }
  | { ok: false; error: string }

function inputToPreference(input: SaveLocalPickupNearMePreferenceInput): LocalPickupNearMePreference {
  if (!input.enabled) {
    return {
      enabled: false,
      location: "",
      lat: null,
      lng: null,
      radiusMi: null,
    }
  }

  return {
    enabled: true,
    location: input.location.trim(),
    lat: input.lat,
    lng: input.lng,
    radiusMi: input.radiusMi,
  }
}

export async function saveLocalPickupNearMePreference(
  input: unknown,
): Promise<SaveLocalPickupNearMePreferenceResult> {
  const parsed = saveLocalPickupNearMePreferenceSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid preference.",
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "Unauthorized." }
  }

  const preference = inputToPreference(parsed.data)
  const saved = await upsertLocalPickupNearMePreferenceForUser(supabase, user.id, preference)
  if (!saved.ok) {
    return saved
  }

  revalidateLocalPickupNearMePreference(user.id)

  return { ok: true, preference }
}
