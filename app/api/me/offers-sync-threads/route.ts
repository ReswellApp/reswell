import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
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
  return NextResponse.json({ data: result }, { status: 200 })
}
