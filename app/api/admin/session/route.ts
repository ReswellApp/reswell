import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** Lightweight check for client UI (show brand admin controls). */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ isAdmin: false })
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()
  return NextResponse.json({ isAdmin: profile?.is_admin === true })
}
