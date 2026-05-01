import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

export type AdminConversationHeaderRow = {
  id: string
  buyer_id: string
  seller_id: string
  listing_id: string | null
  listing: { title: string | null } | null
  buyer: { display_name: string | null } | null
  seller: { display_name: string | null } | null
}

const SELECT = `
  id,
  buyer_id,
  seller_id,
  listing_id,
  listing:listings (title),
  buyer:profiles!conversations_buyer_id_fkey (display_name),
  seller:profiles!conversations_seller_id_fkey (display_name)
`

export async function getAdminConversationHeaderById(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ data: AdminConversationHeaderRow | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("conversations")
    .select(SELECT)
    .eq("id", conversationId)
    .maybeSingle()

  if (error) {
    return { data: null, error }
  }
  return { data: data as AdminConversationHeaderRow | null, error: null }
}
