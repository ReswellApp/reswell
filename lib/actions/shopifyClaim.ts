"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { claimShopifyPendingInstallation } from "@/lib/services/shopifyClaim"
import { SHOPIFY_CLAIM_COOKIE } from "@/lib/shopify/claim-cookie"

export async function claimShopifyInstallAction(): Promise<
  { success: true } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Sign in to link this Shopify store to Reswell." }
  }

  const cookieStore = await cookies()
  const claimSecret = cookieStore.get(SHOPIFY_CLAIM_COOKIE)?.value?.trim()
  if (!claimSecret) {
    return { error: "This Shopify install session has expired. Install again from Shopify." }
  }

  try {
    await claimShopifyPendingInstallation({
      userId: user.id,
      claimSecret,
    })
    cookieStore.set(SHOPIFY_CLAIM_COOKIE, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    })
    revalidatePath("/dashboard/shopify")
    revalidatePath("/shopify/claim")
    return { success: true }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not link Shopify store"
    return { error: message }
  }
}
