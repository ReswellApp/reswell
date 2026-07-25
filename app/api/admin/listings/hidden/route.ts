import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  fetchAdminHiddenListings,
  summarizeAdminHiddenListings,
} from "@/lib/db/adminHiddenListings"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { setListingSiteVisibility } from "@/lib/services/listingSiteVisibility"
import { revalidateAfterListingSiteModeration } from "@/lib/services/listingSiteModerationRevalidation"

const SUPER_ADMIN_EMAIL = "haydensbsb@gmail.com"

const unhideBodySchema = z.object({
  listing_ids: z.array(z.string().uuid()).min(1).max(100),
})

function canModerate(
  email: string | undefined,
  profile: { is_admin?: boolean | null; is_employee?: boolean | null } | null,
): boolean {
  if (!email) return false
  if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return true
  return profile?.is_admin === true || profile?.is_employee === true
}

export async function GET(request: NextRequest) {
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

  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const checkoutBlockedOnly =
    request.nextUrl.searchParams.get("checkout_blocked") === "1"

  const { rows, error } = await fetchAdminHiddenListings(service, {
    checkoutBlockedOnly,
  })
  if (error) {
    console.error("[admin hidden listings GET]", error)
    return NextResponse.json({ error: "Failed to load hidden listings" }, { status: 500 })
  }

  return NextResponse.json({
    listings: rows,
    summary: summarizeAdminHiddenListings(rows),
  })
}

/** Bulk restore site visibility (`hidden_from_site = false`). */
export async function PATCH(request: NextRequest) {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = unhideBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const unhiddenIds: string[] = []
  const failed: { id: string; error: string }[] = []

  for (const listingId of parsed.data.listing_ids) {
    const result = await setListingSiteVisibility({
      listingId,
      hiddenFromSite: false,
      source: "admin_restore",
      actorUserId: user.id,
    })
    if (!result.ok) {
      failed.push({ id: listingId, error: result.message })
      continue
    }
    unhiddenIds.push(listingId)
  }

  if (unhiddenIds.length > 0) {
    const supabaseForEs = await createClient()
    await Promise.all(
      unhiddenIds.map(async (listingId) => {
        await syncListingToIndex(supabaseForEs, listingId)
        void syncListingToGoogleMerchantBestEffort(supabaseForEs, listingId)
      }),
    )
    await revalidateAfterListingSiteModeration(supabaseForEs, unhiddenIds)
  }

  return NextResponse.json({
    success: failed.length === 0,
    unhidden_ids: unhiddenIds,
    failed,
  })
}
