import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { IMPERSONATION_COOKIE } from "@/lib/impersonation"

function slugifyThread(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80)
}

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

  const { title, body: threadBody } = await request.json()
  if (!title?.trim() || !threadBody?.trim()) {
    return NextResponse.json({ error: "Title and body required" }, { status: 400 })
  }

  const baseSlug = slugifyThread(title.trim())
  let slug = baseSlug || "thread"
  const { count } = await service
    .from("forum_threads")
    .select("id", { count: "exact", head: true })
    .eq("slug", slug)
  if (count) {
    for (let i = 2; i < 200; i++) {
      const candidate = `${baseSlug}-${i}`
      const { count: c } = await service
        .from("forum_threads")
        .select("id", { count: "exact", head: true })
        .eq("slug", candidate)
      if (!c) {
        slug = candidate
        break
      }
    }
  }

  const { data: row, error: insertErr } = await service
    .from("forum_threads")
    .insert({
      user_id: impersonation.userId,
      title: title.trim(),
      slug,
      body: threadBody.trim(),
    })
    .select("slug")
    .single()

  if (insertErr || !row) {
    console.error("[impersonate] forum_threads insert error:", insertErr)
    return NextResponse.json({ error: "Failed to create thread" }, { status: 500 })
  }

  return NextResponse.json({ success: true, slug: row.slug })
}
