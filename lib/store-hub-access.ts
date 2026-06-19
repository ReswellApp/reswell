import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  getConsignmentStoreBySlug,
  getStoreStaffRole,
} from "@/lib/db/consignmentStores"
import type { ConsignmentStore } from "@/lib/types/consignment"
import type { ConsignmentStoreStaffRole } from "@/lib/types/consignment"
import type { SupabaseClient } from "@supabase/supabase-js"
import { profileHasConsignmentShopRole } from "@/lib/services/consignmentShopAccess"

export type StoreHubContext = {
  supabase: SupabaseClient
  store: ConsignmentStore
  role: ConsignmentStoreStaffRole
  userId: string
}

/**
 * Load store context for hub pages. Auth is enforced by `(hub)/layout.tsx`;
 * this helper is for data fetching inside child pages.
 */
export async function getStoreHubContext(slug: string): Promise<StoreHubContext> {
  const supabase = await createClient()

  const store = await getConsignmentStoreBySlug(supabase, slug)
  if (!store) {
    notFound()
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    notFound()
  }

  const role = await getStoreStaffRole(supabase, store.id, user.id)
  if (!role) {
    notFound()
  }

  const granted = await profileHasConsignmentShopRole(supabase, user.id)
  if (!granted) {
    notFound()
  }

  return { supabase, store, role, userId: user.id }
}
