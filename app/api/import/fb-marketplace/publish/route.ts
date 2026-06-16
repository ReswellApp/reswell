import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import {
  LISTING_IMPORT_ACCESS_COOKIE,
  userHasListingImportAccess,
} from "@/lib/import-listing-access"
import { publishImportListing } from "@/lib/services/publishImportListing"
import { fbMarketplacePublishBodySchema } from "@/lib/validations/fb-marketplace-import"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Sign in to publish your listing." }, { status: 401 })
  }

  const cookieStore = await cookies()
  const queryKey = request.nextUrl.searchParams.get("key")
  const allowed = await userHasListingImportAccess({
    supabase,
    userId: user.id,
    queryKey,
    cookieValue: cookieStore.get(LISTING_IMPORT_ACCESS_COOKIE)?.value,
  })

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = fbMarketplacePublishBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }

  let serviceSupabase
  try {
    serviceSupabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const result = await publishImportListing({
    supabase,
    serviceSupabase,
    userId: user.id,
    userEmail: user.email ?? null,
    input: parsed.data,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    data: {
      listingId: result.listingId,
      slug: result.slug,
    },
  })
}
