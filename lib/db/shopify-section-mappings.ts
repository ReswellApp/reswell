import type { SupabaseClient } from "@supabase/supabase-js"
import type { ShopifySectionMappingRow } from "@/lib/shopify/types"

const MAPPING_SELECT =
  "id, user_id, connection_id, signal_type, signal_value, reswell_section, priority" as const

export async function listShopifySectionMappingsForUser(
  supabase: SupabaseClient,
  userId: string,
  connectionId?: string | null,
): Promise<ShopifySectionMappingRow[]> {
  let query = supabase.from("shopify_section_mappings").select(MAPPING_SELECT).eq("user_id", userId)

  if (connectionId) {
    query = query.or(`connection_id.eq.${connectionId},connection_id.is.null`)
  }

  const { data, error } = await query.order("priority", { ascending: true })
  if (error) throw new Error(error.message)
  return (data as ShopifySectionMappingRow[]) ?? []
}

export async function replaceShopifySectionMappings(
  supabase: SupabaseClient,
  userId: string,
  connectionId: string,
  mappings: Array<{
    signal_type: ShopifySectionMappingRow["signal_type"]
    signal_value: string
    reswell_section: ShopifySectionMappingRow["reswell_section"]
    priority?: number
  }>,
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("shopify_section_mappings")
    .delete()
    .eq("user_id", userId)
    .eq("connection_id", connectionId)

  if (deleteError) throw new Error(deleteError.message)

  if (mappings.length === 0) return

  const rows = mappings.map((m, index) => ({
    user_id: userId,
    connection_id: connectionId,
    signal_type: m.signal_type,
    signal_value: m.signal_value.trim(),
    reswell_section: m.reswell_section,
    priority: m.priority ?? (index + 1) * 10,
  }))

  const { error: insertError } = await supabase.from("shopify_section_mappings").insert(rows)
  if (insertError) throw new Error(insertError.message)
}

export const DEFAULT_SHOPIFY_SECTION_MAPPINGS: Array<{
  signal_type: ShopifySectionMappingRow["signal_type"]
  signal_value: string
  reswell_section: ShopifySectionMappingRow["reswell_section"]
  priority: number
}> = [
  { signal_type: "product_type", signal_value: "Fin", reswell_section: "fins", priority: 10 },
  { signal_type: "product_type", signal_value: "Fins", reswell_section: "fins", priority: 11 },
  { signal_type: "product_type", signal_value: "Wetsuit", reswell_section: "wetsuits", priority: 20 },
  { signal_type: "product_type", signal_value: "Wetsuits", reswell_section: "wetsuits", priority: 21 },
  { signal_type: "product_type", signal_value: "Surfboard", reswell_section: "surfboards", priority: 30 },
  { signal_type: "product_type", signal_value: "Boardbag", reswell_section: "boardbags", priority: 40 },
  { signal_type: "product_type", signal_value: "Leash", reswell_section: "leashes", priority: 50 },
  { signal_type: "product_type", signal_value: "Apparel", reswell_section: "apparel", priority: 60 },
  { signal_type: "tag", signal_value: "reswell", reswell_section: "accessories", priority: 900 },
]
