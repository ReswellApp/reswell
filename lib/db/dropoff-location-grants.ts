import type { SupabaseClient } from "@supabase/supabase-js"

export type DropoffLocationGrantRow = {
  id: string
  userId: string
  dropoffLocationId: string
  createdAt: string
}

function mapGrant(row: Record<string, unknown>): DropoffLocationGrantRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    dropoffLocationId: String(row.dropoff_location_id),
    createdAt: String(row.created_at ?? ""),
  }
}

export async function getDropoffLocationGrantByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<DropoffLocationGrantRow | null> {
  const { data, error } = await supabase
    .from("dropoff_location_grants")
    .select("id, user_id, dropoff_location_id, created_at")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapGrant(data as Record<string, unknown>)
}

export async function listDropoffLocationGrantRows(
  supabase: SupabaseClient,
): Promise<DropoffLocationGrantRow[]> {
  const { data, error } = await supabase
    .from("dropoff_location_grants")
    .select("id, user_id, dropoff_location_id, created_at")
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => mapGrant(row as Record<string, unknown>))
}

export async function upsertDropoffLocationGrant(
  supabase: SupabaseClient,
  input: { userId: string; dropoffLocationId: string; grantedBy: string },
): Promise<void> {
  const { error } = await supabase.from("dropoff_location_grants").upsert(
    {
      user_id: input.userId,
      dropoff_location_id: input.dropoffLocationId,
      granted_by: input.grantedBy,
    },
    { onConflict: "user_id" },
  )
  if (error) throw error
}

export async function deleteDropoffLocationGrant(
  supabase: SupabaseClient,
  grantId: string,
): Promise<void> {
  const { error } = await supabase.from("dropoff_location_grants").delete().eq("id", grantId)
  if (error) throw error
}
