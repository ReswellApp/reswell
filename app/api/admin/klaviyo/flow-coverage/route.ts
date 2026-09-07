import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import {
  getKlaviyoFlowCoverage,
  KlaviyoFlowCoverageError,
} from "@/lib/services/klaviyoFlowCoverage"

export async function GET(req: NextRequest) {
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

  if (!profile?.is_admin && !profile?.is_employee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const refresh =
    req.nextUrl.searchParams.get("refresh") === "1" ||
    req.nextUrl.searchParams.get("refresh") === "true"

  try {
    const data = await getKlaviyoFlowCoverage({ refresh })
    return NextResponse.json(data, { status: 200 })
  } catch (e) {
    if (e instanceof KlaviyoFlowCoverageError) {
      const status =
        e.missingKey ? 503 : e.status === 401 || e.status === 403 ? 502 : e.status >= 400 ? 502 : 500
      return NextResponse.json(
        {
          error: e.message,
          missingKey: e.missingKey || undefined,
          scopeHint: e.scopeHint || undefined,
        },
        { status },
      )
    }
    console.error("[admin/klaviyo/flow-coverage]", e)
    return NextResponse.json({ error: "Failed to load Klaviyo flow coverage" }, { status: 500 })
  }
}
