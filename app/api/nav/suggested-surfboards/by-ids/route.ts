import { NextResponse } from "next/server"
import { z } from "zod"
import { fetchNavSuggestedSurfboardsByIds } from "@/lib/db/nav-suggested-surfboards"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

const idsQuerySchema = z
  .string()
  .min(1)
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().uuid()).max(12).min(1))

/**
 * GET `/api/nav/suggested-surfboards/by-ids?ids=uuid,uuid`
 * Uncached rows for nav engagement boosts (browser-local scores).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const parsed = idsQuerySchema.safeParse(searchParams.get("ids") ?? "")
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid or missing ids" }, { status: 400 })
    }

    const supabase = createAnonSupabaseClient()
    const rows = await fetchNavSuggestedSurfboardsByIds(supabase, parsed.data)

    return NextResponse.json({ data: { rows } }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 })
  }
}
