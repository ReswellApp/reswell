import { createClient } from "@/lib/supabase/server"
import { getSellerBalanceSheetPage } from "@/lib/db/sellerBalanceSheet"
import type { SellerBalanceSheetPage } from "@/lib/types/sellerBalanceSheet"

export class SellerBalanceSheetAccessError extends Error {
  constructor() {
    super("Admin access is required.")
    this.name = "SellerBalanceSheetAccessError"
  }
}

export async function getAdminSellerBalanceSheet(
  page: number,
  pageSize: number,
): Promise<SellerBalanceSheetPage> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new SellerBalanceSheetAccessError()
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (profileError) {
    console.error("[sellerBalanceSheet] admin profile lookup failed", {
      userId: user.id,
      code: profileError.code,
      message: profileError.message,
      timestamp: new Date().toISOString(),
    })
    throw profileError
  }

  if (profile?.is_admin !== true) {
    throw new SellerBalanceSheetAccessError()
  }

  try {
    return await getSellerBalanceSheetPage(supabase, user.id, page, pageSize)
  } catch (error) {
    console.error("[sellerBalanceSheet] balance sheet query failed", {
      userId: user.id,
      page,
      pageSize,
      error,
      timestamp: new Date().toISOString(),
    })
    throw error
  }
}
