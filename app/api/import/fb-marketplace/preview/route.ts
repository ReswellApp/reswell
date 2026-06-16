import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import {
  LISTING_IMPORT_ACCESS_COOKIE,
  isListingImportAccessKeyValid,
  userHasListingImportAccess,
} from "@/lib/import-listing-access"
import { previewFbMarketplaceListing } from "@/lib/services/fbMarketplaceImport"
import { fbMarketplacePreviewBodySchema } from "@/lib/validations/fb-marketplace-import"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const cookieStore = await cookies()
  const queryKey = request.nextUrl.searchParams.get("key")
  const allowed = await userHasListingImportAccess({
    supabase,
    userId: user?.id ?? null,
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

  const parsed = fbMarketplacePreviewBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }

  try {
    const data = await previewFbMarketplaceListing(parsed.data.url)
    const res = NextResponse.json({ data })
    if (isListingImportAccessKeyValid(queryKey)) {
      res.cookies.set(LISTING_IMPORT_ACCESS_COOKIE, "1", {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
      })
    }
    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
