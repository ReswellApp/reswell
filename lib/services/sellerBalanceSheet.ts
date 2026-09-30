import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import {
  getSellerBalanceSheetPage,
  updateOwnedListingAcquisition,
} from "@/lib/db/sellerBalanceSheet"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import type { SellerBalanceSheetPage } from "@/lib/types/sellerBalanceSheet"
import type { UpdateListingAcquisitionInput } from "@/lib/validations/listing-acquisition"

export class SellerBalanceSheetAccessError extends Error {
  constructor() {
    super("Admin access is required.")
    this.name = "SellerBalanceSheetAccessError"
  }
}

export async function getAdminSellerBalanceSheet(
  page: number,
  pageSize: number,
  listingSection: PeerListingSection | null,
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
    return await getSellerBalanceSheetPage(
      supabase,
      user.id,
      page,
      pageSize,
      listingSection,
    )
  } catch (error) {
    console.error("[sellerBalanceSheet] balance sheet query failed", {
      userId: user.id,
      page,
      pageSize,
      listingSection,
      error,
      timestamp: new Date().toISOString(),
    })
    throw error
  }
}

export async function updateSellerListingAcquisition(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateListingAcquisitionInput,
): Promise<boolean> {
  return updateOwnedListingAcquisition(supabase, userId, input)
}
