import type { SupabaseClient } from "@supabase/supabase-js"
import { insertSellFunnelEvent } from "@/lib/db/sellFunnelEvents"
import type { SellFunnelEventInput } from "@/lib/validations/sell-funnel-event"

export async function recordSellFunnelEvent(
  supabase: SupabaseClient,
  input: SellFunnelEventInput,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await insertSellFunnelEvent(supabase, {
    ...input,
    userId: user?.id ?? null,
  })
}
