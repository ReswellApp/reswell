import { NextResponse } from "next/server"
import { z } from "zod"
import { backfillShopFollowsKlaviyo } from "@/lib/services/backfillShopFollowsKlaviyo"

const bodySchema = z
  .object({
    /** Optional cap for staged rollouts / dry runs. */
    limit: z.number().int().positive().max(50_000).optional(),
  })
  .optional()

/**
 * Enter every existing shop-follow into Klaviyo (**Shop Followed** + **Following Shop**
 * with `is_backfill: true`). Auth: `Authorization: Bearer $CRON_SECRET` when set.
 *
 * Build seller email flow on **Shop Followed** with filter `is_backfill` ≠ true so this
 * backfill does not email sellers about historical follows.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let limit: number | undefined
  try {
    const raw = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    limit = parsed.data?.limit
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  try {
    const result = await backfillShopFollowsKlaviyo({ limit })
    return NextResponse.json({
      ok: true,
      message:
        "Backfill complete. Metrics **Shop Followed** (seller) and **Following Shop** (follower) were emitted with is_backfill=true. Filter live seller emails on is_backfill ≠ true.",
      result,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
