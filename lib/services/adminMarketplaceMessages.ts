import {
  deleteMarketplaceMessageAsAdmin,
  listAdminMarketplaceMessages,
  type ListAdminMarketplaceMessagesArgs,
} from "@/lib/db/adminMarketplaceMessages"
import { createServiceRoleClient } from "@/lib/supabase/server"

export async function getAdminMarketplaceMessages(args: ListAdminMarketplaceMessagesArgs) {
  const supabase = createServiceRoleClient()
  return listAdminMarketplaceMessages(supabase, args)
}

export async function removeAdminMarketplaceMessage(messageId: string) {
  const supabase = createServiceRoleClient()
  return deleteMarketplaceMessageAsAdmin(supabase, messageId)
}
