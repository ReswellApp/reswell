import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import {
  deleteSupportMacro,
  insertSupportMacro,
  listActiveSupportMacros,
  listSupportMacrosAdmin,
  updateSupportMacro,
  type SupportMacroRecord,
} from "@/lib/db/supportMacros"
import type {
  CreateSupportMacroInput,
  DeleteSupportMacroInput,
  UpdateSupportMacroInput,
} from "@/lib/validations/supportMacros"

type ServiceError = { error: string }
type Authed =
  | { ok: false; error: string }
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>> }

async function requireStaff(): Promise<Authed> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { ok: false, error: "Forbidden" }
  }
  return { ok: true, supabase }
}

function dbClient(userClient: Awaited<ReturnType<typeof createClient>>) {
  try {
    return createServiceRoleClient()
  } catch {
    return userClient
  }
}

export async function listSupportMacrosAdminService(): Promise<
  { success: true; data: SupportMacroRecord[] } | ServiceError
> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  try {
    const data = await listSupportMacrosAdmin(dbClient(staff.supabase))
    return { success: true, data }
  } catch (error) {
    console.error("[support_macros] list admin failed:", error)
    return { error: "Could not load macros" }
  }
}

export async function listActiveSupportMacrosService(): Promise<
  { success: true; data: SupportMacroRecord[] } | ServiceError
> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  try {
    const data = await listActiveSupportMacros(dbClient(staff.supabase))
    return { success: true, data }
  } catch (error) {
    console.error("[support_macros] list active failed:", error)
    return { error: "Could not load macros" }
  }
}

export async function createSupportMacroService(
  input: CreateSupportMacroInput,
): Promise<{ success: true; data: SupportMacroRecord } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  try {
    const data = await insertSupportMacro(dbClient(staff.supabase), {
      title: input.title,
      body: input.body,
      kind_filter: input.kind_filter ?? null,
      is_active: input.is_active,
      sort_order: input.sort_order,
    })
    return { success: true, data }
  } catch (error) {
    console.error("[support_macros] create failed:", error)
    return { error: "Could not create macro" }
  }
}

export async function updateSupportMacroService(
  input: UpdateSupportMacroInput,
): Promise<{ success: true; data: SupportMacroRecord } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  try {
    const data = await updateSupportMacro(dbClient(staff.supabase), {
      id: input.id,
      title: input.title,
      body: input.body,
      kind_filter: input.kind_filter,
      is_active: input.is_active,
      sort_order: input.sort_order,
    })
    return { success: true, data }
  } catch (error) {
    console.error("[support_macros] update failed:", error)
    return { error: "Could not update macro" }
  }
}

export async function deleteSupportMacroService(
  input: DeleteSupportMacroInput,
): Promise<{ success: true } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  try {
    await deleteSupportMacro(dbClient(staff.supabase), input.id)
    return { success: true }
  } catch (error) {
    console.error("[support_macros] delete failed:", error)
    return { error: "Could not delete macro" }
  }
}
