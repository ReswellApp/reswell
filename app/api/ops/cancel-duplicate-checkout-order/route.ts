import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { cancelDuplicateMarketplaceCheckoutOrder } from "@/lib/services/cancelDuplicateMarketplaceCheckoutOrder"
import { isCronRequestAuthorized } from "@/lib/utils/cron-auth"

const bodySchema = z
  .object({
    cancelOrderId: z.string().uuid(),
    keepOrderId: z.string().uuid(),
  })
  .strict()

/**
 * POST /api/ops/cancel-duplicate-checkout-order
 *
 * One-shot ops helper for duplicate Stripe checkouts on the same listing.
 * Auth: Bearer CRON_SECRET, or Bearer SUPABASE_SERVICE_ROLE_KEY when CRON_SECRET is unset.
 * Refunds only `cancelOrderId` (`cancel_unshipped`); refuses unless `keepOrderId` is still open
 * on the same listing. Listing relist is skipped while the keeper checkout remains open.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  // Accept either cron or service-role bearer so cloud ops can run with the
  // service key when CRON_SECRET is not available locally.
  const authorized =
    isCronRequestAuthorized(request, cronSecret) ||
    isCronRequestAuthorized(request, serviceRole)

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  const result = await cancelDuplicateMarketplaceCheckoutOrder(supabase, parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true, data: result })
}
