import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { IMPERSONATION_COOKIE } from "@/lib/impersonation"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const raw = request.cookies.get(IMPERSONATION_COOKIE)?.value
  if (!raw) {
    return NextResponse.json({ error: "Not impersonating" }, { status: 400 })
  }

  let impersonation: { userId: string }
  try {
    impersonation = JSON.parse(decodeURIComponent(raw))
  } catch {
    return NextResponse.json({ error: "Invalid impersonation cookie" }, { status: 400 })
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const { threadId, body: commentBody, parentId } = await request.json()
  if (!threadId || !commentBody?.trim()) {
    return NextResponse.json({ error: "threadId and body required" }, { status: 400 })
  }

  const { data: inserted, error: insertErr } = await service
    .from("forum_comments")
    .insert({
      thread_id: threadId,
      user_id: impersonation.userId,
      body: commentBody.trim(),
      parent_id: parentId || null,
    })
    .select("id, body, created_at, user_id, parent_id")
    .single()

  if (insertErr || !inserted) {
    console.error("[impersonate] forum_comments insert error:", insertErr)
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
  }

  return NextResponse.json({ success: true, comment: inserted })
}
