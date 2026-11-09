import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrantableAccountRole } from "@/lib/account-access/permissions"

export interface AccountMemberRow {
  id: string
  account_id: string
  email: string
  member_user_id: string | null
  role: GrantableAccountRole
  status: "invited" | "active" | "revoked"
  invited_by: string
  created_at: string
  accepted_at: string | null
}

const MEMBER_COLUMNS =
  "id, account_id, email, member_user_id, role, status, invited_by, created_at, accepted_at"

export async function listLiveAccountMembers(
  supabase: SupabaseClient,
  accountId: string,
): Promise<AccountMemberRow[]> {
  const { data, error } = await supabase
    .from("account_members")
    .select(MEMBER_COLUMNS)
    .eq("account_id", accountId)
    .in("status", ["invited", "active"])
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[account-members] list failed", {
      accountId,
      message: error.message,
      timestamp: new Date().toISOString(),
    })
    return []
  }

  return (data ?? []) as AccountMemberRow[]
}

export async function listActiveMembershipsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountMemberRow[]> {
  const { data, error } = await supabase
    .from("account_members")
    .select(MEMBER_COLUMNS)
    .eq("member_user_id", userId)
    .eq("status", "active")

  if (error) {
    console.error("[account-members] memberships failed", {
      userId,
      message: error.message,
      timestamp: new Date().toISOString(),
    })
    return []
  }

  return (data ?? []) as AccountMemberRow[]
}

export async function listPendingInvitesForEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<AccountMemberRow[]> {
  const { data, error } = await supabase
    .from("account_members")
    .select(MEMBER_COLUMNS)
    .eq("email", email)
    .eq("status", "invited")

  if (error) {
    console.error("[account-members] pending invites failed", {
      message: error.message,
      timestamp: new Date().toISOString(),
    })
    return []
  }

  return (data ?? []) as AccountMemberRow[]
}
