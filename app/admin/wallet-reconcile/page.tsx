import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { WalletReconcileClient } from "./wallet-reconcile-client"

export const metadata = privatePageMetadata({
  title: "Stripe wallet sync — Admin — Reswell",
  description: "Reconcile marketplace Stripe refunds with seller wallet balances.",
  path: "/admin/wallet-reconcile",
})

export default async function AdminWalletReconcilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/admin/wallet-reconcile")
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()

  if (!profile?.is_admin) {
    redirect("/")
  }

  return <WalletReconcileClient />
}
