import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkShopifyMerchantAccess } from "@/lib/services/shopifyAccess"

export async function requireShopifyMerchant() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Sign in required" }, { status: 401 }),
    }
  }
  try {
    const access = await checkShopifyMerchantAccess(supabase, user.id)
    if (!access.allowed) {
      const status = access.reason === "not_approved" ? 403 : 503
      return {
        ok: false as const,
        response: NextResponse.json({ error: access.message }, { status }),
      }
    }
    return { ok: true as const, user }
  } catch (error) {
    console.error("[shopify] access check", error)
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Could not verify Shopify access" },
        { status: 500 },
      ),
    }
  }
}
