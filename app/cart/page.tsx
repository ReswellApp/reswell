import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCartPageItems } from "@/app/actions/cart"
import { CartPageView } from "@/components/cart-page-view"

export const metadata: Metadata = {
  title: "Cart — Reswell",
  description: "Saved marketplace listings ready for checkout.",
}

export default async function CartPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent("/cart")}`)
  }

  const { items, error } = await getCartPageItems()

  return <CartPageView initialItems={items} loadError={error} />
}
