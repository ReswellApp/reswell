"use server"

import {
  loadProfileBrowseHomeForUser,
  saveProfileBrowseHome,
  type ProfileBrowseHomeState,
  type SaveProfileBrowseHomeResult,
} from "@/lib/services/profileBrowseHome"
import { createClient } from "@/lib/supabase/server"

export async function getProfileBrowseHomeState(): Promise<
  { error: string } | ProfileBrowseHomeState
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  return loadProfileBrowseHomeForUser(user.id)
}

export async function saveProfileBrowseHomeAction(
  input: unknown,
): Promise<SaveProfileBrowseHomeResult> {
  return saveProfileBrowseHome(input)
}
