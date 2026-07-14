import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { publishListingDraft } from "@/lib/services/publishListingDraft"

const SUPER_ADMIN_EMAIL = "haydensbsb@gmail.com"

const listingIdParamSchema = z.string().uuid("Invalid listing id")

function canModerate(
  email: string | undefined,
  profile: { is_admin?: boolean | null; is_employee?: boolean | null } | null,
): boolean {
  if (!email) return false
  if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return true
  return profile?.is_admin === true || profile?.is_employee === true
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .single()

  if (!canModerate(user.email ?? undefined, profile)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: rawId } = await context.params
  const parsedId = listingIdParamSchema.safeParse(rawId)
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
  }

  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const result = await publishListingDraft(service, parsedId.data)

  if (!result.ok) {
    const status = result.message === "Listing not found" ? 404 : 400
    return NextResponse.json({ error: result.message }, { status })
  }

  return NextResponse.json({
    data: {
      listing_id: result.listingId,
      slug: result.slug,
    },
  })
}
