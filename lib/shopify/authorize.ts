import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { getShopAccountContext } from "@/lib/services/accountAccess"
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

  const shop = await getShopAccountContext()
  if (!shop || !shop.permissions.has("listings.read")) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "You don't have access to that." }, { status: 403 }),
    }
  }

  try {
    const access = await checkShopifyMerchantAccess(supabase, shop.accountId)
    if (!access.allowed) {
      const status = access.reason === "not_approved" ? 403 : 503
      return {
        ok: false as const,
        response: NextResponse.json({ error: access.message }, { status }),
      }
    }
    return {
      ok: true as const,
      user: user as User,
      accountId: shop.accountId,
      canManageConnection: shop.permissions.has("profile.manage"),
    }
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
