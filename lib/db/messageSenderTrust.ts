import type { SupabaseClient } from "@supabase/supabase-js"

export type MessageSenderTrustProfileRow = {
  createdAt: string
  phone: string | null
}

export async function fetchMessageSenderTrustProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<MessageSenderTrustProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("created_at, phone")
    .eq("id", userId)
    .maybeSingle()

  if (error || !data) {
    console.error("[fetchMessageSenderTrustProfile]", error?.message ?? "profile missing")
    return null
  }

  return {
    createdAt: typeof data.created_at === "string" ? data.created_at : new Date(0).toISOString(),
    phone: typeof data.phone === "string" ? data.phone : null,
  }
}

/** True when the user has at least one confirmed marketplace purchase as buyer. */
export async function userHasCompletedPurchase(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean | null> {
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("buyer_id", userId)
    .eq("status", "confirmed")

  if (error) {
    console.error("[userHasCompletedPurchase]", error.message)
    return null
  }

  return (count ?? 0) > 0
}
