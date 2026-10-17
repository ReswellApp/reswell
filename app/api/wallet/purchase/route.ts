import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"

/**
 * Retired. Wallet purchases now go through `/api/wallet/checkout`, which posts a
 * balanced Reswell Bucks journal and is limited to admins.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isAnonymousSupabaseUser(user)) {
    return NextResponse.json(
      { error: "Create a Reswell account or sign in to pay with your wallet." },
      { status: 403 },
    )
  }

  return NextResponse.json(
    {
      error:
        "Reswell Bucks checkout is an admin pilot on the checkout page. This endpoint no longer moves wallet funds.",
    },
    { status: 410 },
  )
}
