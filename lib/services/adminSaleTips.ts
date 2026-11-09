import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import { sanitizeAdminSaleTipSearch } from "@/lib/admin/sale-tip-filters"
import { dbListAdminSaleTips } from "@/lib/db/adminSaleTips"
import type { AdminSaleTipDirectory } from "@/lib/types/adminSaleTips"
import { adminSaleTipListQuerySchema } from "@/lib/validations/adminSaleTips"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

type ListResult = { success: true; data: AdminSaleTipDirectory } | { error: string }

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user || isAnonymousSupabaseUser(data.user)) {
    return { ok: false, error: "Sign in required" }
  }
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", data.user.id)
    .maybeSingle()
  if (error) {
    console.error("[adminSaleTips] admin check failed", error)
    return { ok: false, error: "Could not verify access" }
  }
  if (profile?.is_admin !== true) return { ok: false, error: "Admin only" }
  return { ok: true }
}

export async function listAdminSaleTipsService(raw: {
  status?: string | string[]
  q?: string | string[]
  seller?: string | string[]
  page?: string | string[]
}): Promise<ListResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  const parsed = adminSaleTipListQuerySchema.safeParse({
    status: firstParam(raw.status),
    q: firstParam(raw.q),
    seller: firstParam(raw.seller),
    page: firstParam(raw.page),
  })
  if (!parsed.success) return { error: "Invalid filters" }

  try {
    const supabase = createServiceRoleClient()
    const data = await dbListAdminSaleTips(supabase, {
      status: parsed.data.status ?? "succeeded",
      q: sanitizeAdminSaleTipSearch(parsed.data.q ?? ""),
      sellerUserId: parsed.data.seller ?? null,
      page: parsed.data.page ?? 1,
    })
    return { success: true, data }
  } catch (error) {
    console.error("[adminSaleTips] list service failed", error)
    return { error: "Could not load seller tips" }
  }
}
