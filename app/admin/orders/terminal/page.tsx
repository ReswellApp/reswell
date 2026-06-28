import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { privatePageMetadata } from "@/lib/site-metadata"
import { AdminTerminalRegisterClient } from "@/components/features/admin/admin-terminal-register-client"

export const metadata = privatePageMetadata({
  title: "In-person checkout — Admin — Reswell",
  description: "Create in-person marketplace orders with Stripe Terminal or card checkout.",
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
          In-person checkout
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search any listing, link it to a walk-in guest or existing member, and collect payment on
          your S710 reader or via card checkout. Orders settle immediately with no pickup code.
        </p>
      </div>
      <AdminTerminalRegisterClient />
    </div>
  )
}
