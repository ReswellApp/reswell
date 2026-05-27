import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { purgeStaleOffers } from "@/lib/services/offerCleanup"
import { syncAllPendingOfferThreadsForUser } from "@/lib/services/syncOfferMessagesThread"

/**
 * Repairs Chats: mirrors any PENDING offers (where the user is buyer or seller)
 * into `conversations` / `messages` when missing. Safe to call repeatedly.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await syncAllPendingOfferThreadsForUser(user.id)

  try {
    const service = createServiceRoleClient()
    void purgeStaleOffers(service)
  } catch {
    // Best-effort; hourly cron is the primary purge path.
  }

  return NextResponse.json({ data: result }, { status: 200 })
}
