import { createClient } from "@/lib/supabase/server"
import { updateOrderSupportRequestAdmin } from "@/lib/db/order-support"
import { updateOrderSupportAdminSchema } from "@/lib/validations/orderSupportAdmin"

export async function updateOrderSupportAdminService(
  raw: unknown,
): Promise<{ success: true } | { error: string }> {
  const parsed = updateOrderSupportAdminSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid input" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { error: "Forbidden" }
  }

  const { error } = await updateOrderSupportRequestAdmin(supabase, {
    id: parsed.data.id,
    support_status: parsed.data.support_status,
    internal_notes: parsed.data.internal_notes,
    outcome: parsed.data.outcome,
    assignee_admin_id: parsed.data.assignee_admin_id,
  })

  if (error) {
    return { error: error.message }
  }
  return { success: true }
}
