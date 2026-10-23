import { NextResponse } from "next/server"
import { loadMarketplaceOrderAccess } from "@/lib/account-access/order-operator-session"
import { resolveOrderPackageTrackingUrl } from "@/lib/services/ensureOrderBrandedTrackingUrl"
import { createClient } from "@/lib/supabase/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function viewerIsAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle()
  const row = data as { is_admin?: boolean | null } | null
  return row?.is_admin === true
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const orderId = id?.trim() ?? ""
  if (!UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const access = await loadMarketplaceOrderAccess(supabase, orderId)
  if (!access.ok && !(await viewerIsAdmin(supabase, user.id))) {
    return NextResponse.json(
      { error: access.status === 401 ? "Unauthorized" : "Not found" },
      { status: access.status === 401 ? 401 : 404 },
    )
  }

  const url = await resolveOrderPackageTrackingUrl(orderId)
  if (!url) {
    return NextResponse.json({ error: "Tracking is not available yet" }, { status: 404 })
  }

  const response = NextResponse.redirect(url, 302)
  response.headers.set("Cache-Control", "no-store")
  return response
}
