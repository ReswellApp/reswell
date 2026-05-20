import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeGoogleMerchantAdmin } from "@/lib/google-merchant/authorize"
import {
  createGoogleMerchantPrimaryDataSource,
  getGoogleMerchantDeveloperRegistration,
  registerGoogleMerchantGcp,
} from "@/lib/services/googleMerchantSetup"

const setupSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("register-gcp"),
    developerEmail: z.string().email().optional(),
  }),
  z.object({
    action: z.literal("create-data-source"),
    displayName: z.string().min(1).max(120).optional(),
  }),
  z.object({
    action: z.literal("get-registration"),
  }),
])

/**
 * One-time Merchant Center + GCP setup helpers.
 * POST /api/integrations/google-merchant/setup
 *
 * Auth: admin session or Bearer GOOGLE_MERCHANT_SETUP_SECRET (or CRON_SECRET).
 *
 * Actions:
 * - register-gcp — links GCP project to Merchant Center
 * - create-data-source — creates primary API feed; save `name` to env
 * - get-registration — read current developer registration status
 */
export async function POST(request: NextRequest) {
  const authorized =
    (await authorizeGoogleMerchantAdmin(request, "GOOGLE_MERCHANT_SETUP_SECRET")) ||
    (await authorizeGoogleMerchantAdmin(request, "CRON_SECRET")) ||
    (await authorizeGoogleMerchantAdmin(request, "SEARCH_REINDEX_SECRET"))

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = setupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    if (parsed.data.action === "register-gcp") {
      const result = await registerGoogleMerchantGcp(parsed.data.developerEmail)
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, details: result.data },
          { status: result.status >= 400 ? result.status : 500 },
        )
      }
      return NextResponse.json({ ok: true, action: "register-gcp", data: result.data })
    }

    if (parsed.data.action === "create-data-source") {
      const result = await createGoogleMerchantPrimaryDataSource(parsed.data.displayName)
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, details: result.data },
          { status: result.status >= 400 ? result.status : 500 },
        )
      }
      return NextResponse.json({
        ok: true,
        action: "create-data-source",
        data: result.data,
        hint: "Set GOOGLE_MERCHANT_DATA_SOURCE_NAME to the returned name field.",
      })
    }

    const result = await getGoogleMerchantDeveloperRegistration()
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, details: result.data },
        { status: result.status >= 400 ? result.status : 500 },
      )
    }
    return NextResponse.json({ ok: true, action: "get-registration", data: result.data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
