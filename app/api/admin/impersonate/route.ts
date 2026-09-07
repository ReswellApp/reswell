import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  IMPERSONATION_COOKIE,
  impersonationCookieOptions,
  serializeImpersonationCookie,
} from "@/lib/impersonation"

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) return null
  return user
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId, displayName, email } = await request.json()
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  let resolvedDisplayName = typeof displayName === "string" && displayName.trim() ? displayName.trim() : ""
  let resolvedEmail = typeof email === "string" ? email : null
  if (!resolvedDisplayName || resolvedEmail == null) {
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", userId)
      .maybeSingle()
    if (!resolvedDisplayName) {
      resolvedDisplayName =
        typeof targetProfile?.display_name === "string" && targetProfile.display_name.trim()
          ? targetProfile.display_name.trim()
          : "User"
    }
    if (resolvedEmail == null && typeof targetProfile?.email === "string") {
      resolvedEmail = targetProfile.email
    }
  }

  const cookieValue = serializeImpersonationCookie({
    userId,
    displayName: resolvedDisplayName || "User",
    email: resolvedEmail,
  })

  const res = NextResponse.json({
    success: true,
    userId,
    displayName: resolvedDisplayName || "User",
    email: resolvedEmail,
  })
  res.cookies.set(IMPERSONATION_COOKIE, cookieValue, impersonationCookieOptions())
  return res
}

export async function DELETE() {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const res = NextResponse.json({ success: true })
  res.cookies.set(IMPERSONATION_COOKIE, "", impersonationCookieOptions(0))
  return res
}
