'use server'

import {
  loadProfilePersonalInfoStateForUser,
  saveProfilePersonalInfo,
  type ProfilePersonalInfoState,
  type SaveProfilePersonalInfoResult,
} from "@/lib/services/profilePersonalInfo"
import { createClient } from "@/lib/supabase/server"

export async function getProfilePersonalInfoState(): Promise<
  { error: string } | ProfilePersonalInfoState
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  return loadProfilePersonalInfoStateForUser(user.id, user.phone)
}

export async function updateProfilePersonalInfoAction(
  input: unknown,
): Promise<SaveProfilePersonalInfoResult> {
  return saveProfilePersonalInfo(input)
}
