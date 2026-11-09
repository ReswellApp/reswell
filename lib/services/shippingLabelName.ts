import { resolveManagedSeller } from "@/lib/account-access/managed-seller"
import { updateProfileShippingLabelName } from "@/lib/db/shippingLabelName"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { shippingLabelNameInputSchema } from "@/lib/validations/shippingLabelName"
import type { SupabaseClient } from "@supabase/supabase-js"

export type SaveShippingLabelNameResult =
  | { ok: true; shipping_label_name: string | null }
  | { ok: false; error: string }

export async function saveShippingLabelName(input: unknown): Promise<SaveShippingLabelNameResult> {
  const parsed = shippingLabelNameInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Unauthorized." }
  }

  const managed = await resolveManagedSeller("profile.manage")
  if (!managed.ok) return { ok: false, error: managed.error }

  const name = parsed.data.shipping_label_name?.trim() || null

  let writeClient: SupabaseClient = supabase
  if (managed.seller.actingAsShop) {
    try {
      writeClient = createServiceRoleClient()
    } catch {
      return { ok: false, error: "Could not update this shop right now." }
    }
  }

  const saved = await updateProfileShippingLabelName(writeClient, managed.seller.sellerId, name)
  if (!saved.ok) return saved

  return { ok: true, shipping_label_name: name }
}
