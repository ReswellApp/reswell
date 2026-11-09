import { privatePageMetadata } from "@/lib/site-metadata"
import { platformAccessForSignedInUser } from "@/lib/account-access/platform-access"
import { UsedBoardMarketDashboardClient } from "@/components/features/admin/used-board-market-dashboard-client"
import { createClient } from "@/lib/supabase/server"

export const metadata = privatePageMetadata({
  title: "Used surfboard market dashboard — Admin — Reswell",
  description:
    "Used surfboard market analytics plus the brand, model, and variant catalog CMS.",
  path: "/admin/used-board-market-dashboard",
})

export default async function AdminUsedBoardMarketDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let catalogOnly = false
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, is_employee")
      .eq("id", user.id)
      .maybeSingle()
    const access = platformAccessForSignedInUser({ profile })
    catalogOnly = access.isEmployee && !access.isAdmin
  }

  return (
    <>
      <h1 className="sr-only">{catalogOnly ? "Brand catalog" : "Used surfboard market dashboard"}</h1>
      <UsedBoardMarketDashboardClient catalogOnly={catalogOnly} />
    </>
  )
}
