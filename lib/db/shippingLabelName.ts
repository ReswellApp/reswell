import type { SupabaseClient } from "@supabase/supabase-js"

export async function updateProfileShippingLabelName(
  supabase: SupabaseClient,
  userId: string,
  shippingLabelName: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("profiles")
    .update({ shipping_label_name: shippingLabelName })
    .eq("id", userId)

  if (error) {
    console.error("[shippingLabelName] update:", error)
    return { ok: false, error: "Could not save the name on your shipping label." }
  }

  return { ok: true }
}
