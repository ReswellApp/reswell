import { revalidateProfileBrowseHome } from "@/lib/cache/revalidate-profile-browse-home"
import { getCachedProfileBrowseHomeForUser } from "@/lib/cache/profile-browse-home"
import { createClient } from "@/lib/supabase/server"
import {
  updateProfileBrowseHomeForUser,
  type ProfileBrowseHome,
} from "@/lib/db/profileBrowseHome"
import {
  saveProfileBrowseHomeSchema,
  type SaveProfileBrowseHomeInput,
} from "@/lib/validations/profileBrowseHome"

export type ProfileBrowseHomeState = ProfileBrowseHome

export async function loadProfileBrowseHomeForUser(userId: string): Promise<ProfileBrowseHomeState> {
  return getCachedProfileBrowseHomeForUser(userId)
}

export type SaveProfileBrowseHomeResult =
  | { ok: true; home: ProfileBrowseHome }
  | { ok: false; error: string }

function inputToHome(input: SaveProfileBrowseHomeInput): ProfileBrowseHome {
  return {
    applyOnBoards: input.applyOnBoards,
    localPickupOnly: input.localPickupOnly,
    location: input.location.trim(),
    lat: input.lat,
    lng: input.lng,
    radiusMi: input.radiusMi,
  }
}

export async function saveProfileBrowseHome(input: unknown): Promise<SaveProfileBrowseHomeResult> {
  const parsed = saveProfileBrowseHomeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid home area.",
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "Unauthorized." }
  }

  const home = inputToHome(parsed.data)
  const saved = await updateProfileBrowseHomeForUser(supabase, user.id, home)
  if (!saved.ok) {
    return saved
  }

  revalidateProfileBrowseHome(user.id)

  return { ok: true, home }
}
