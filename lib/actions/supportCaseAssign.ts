"use server"

import { revalidatePath } from "next/cache"
import { assignSupportCaseService } from "@/lib/services/supportCaseAssign"
import { listStaffAssignees } from "@/lib/db/searchInsightActions"
import { createClient } from "@/lib/supabase/server"

export async function assignSupportCaseAction(raw: unknown) {
  const result = await assignSupportCaseService(raw)
  if ("error" in result) return { error: result.error }
  revalidatePath("/admin/contact-messages")
  if (
    typeof raw === "object" &&
    raw !== null &&
    "id" in raw &&
    typeof raw.id === "string"
  ) {
    revalidatePath(`/admin/support/${raw.id}`)
    revalidatePath(`/support/${raw.id}`)
  }
  return { success: true as const }
}

export async function listSupportStaffAction() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" as const, rows: [], currentUserId: null as string | null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { error: "Forbidden" as const, rows: [], currentUserId: null as string | null }
  }

  const { rows } = await listStaffAssignees(supabase)
  return {
    rows,
    currentUserId: user.id,
    isAdmin: profile.is_admin === true,
  }
}
