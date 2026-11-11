import type { SupabaseClient } from "@supabase/supabase-js"

/** Writes birthday only when the profile row still has none (existing accounts stay null). */
export async function insertSignupDateOfBirthIfEmpty(
  supabase: SupabaseClient,
  userId: string,
  dateOfBirth: string,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      date_of_birth: dateOfBirth,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .is("date_of_birth", null)

  if (error) {
    throw new Error(error.message)
  }
}
