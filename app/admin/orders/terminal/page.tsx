import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { privatePageMetadata } from "@/lib/site-metadata"
import { AdminTerminalRegisterClient } from "@/components/features/admin/admin-terminal-register-client"

export const metadata = privatePageMetadata({
  title: "Terminal checkout — Admin — Reswell",
  description: "Ring up marketplace listings with Stripe Terminal tap-to-pay.",
  path: "/admin/orders/terminal",
})

export default async function AdminTerminalCheckoutPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?redirect=/admin/orders/terminal")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    redirect("/")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">
          Terminal checkout
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search any listing, enter walk-in customer details, and charge list price on your S710.
          No Reswell account or shipping/pickup choice required.
        </p>
      </div>
      <AdminTerminalRegisterClient />
    </div>
  )
}
