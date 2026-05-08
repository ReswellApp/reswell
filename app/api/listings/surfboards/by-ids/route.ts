import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { fetchPdpRecentSurfboardListings } from "@/lib/services/pdp-recent-strip-listings"

const idsQuerySchema = z
  .string()
  .min(1)
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().uuid()).max(24).min(1))

/**
 * GET `/api/listings/surfboards/by-ids?ids=uuid,uuid`
 * Public surfboard rows for PDP “recently viewed” strips (active listings only), in request order.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const rawIds = searchParams.get("ids") ?? ""
    const parsed = idsQuerySchema.safeParse(rawIds)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid or missing ids" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const listings = await fetchPdpRecentSurfboardListings(
      supabase,
      parsed.data,
      user?.id ?? null,
    )

    return NextResponse.json({ data: { listings } }, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
