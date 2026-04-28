import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { BoardCatalogSnapshotsClient } from "@/components/features/admin/board-catalog-snapshots-client"

export const metadata = privatePageMetadata({
  title: "User Listings Board Data — Admin — Reswell",
  description:
    "Review surfboard listing field snapshots from sellers and convert them into normalized brand catalog variants.",
  path: "/admin/listings/board-catalog-data",
})

export default async function AdminBoardCatalogDataPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/admin/listings/board-catalog-data")
  }
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
  if (!profile?.is_admin) {
    redirect("/admin")
  }
  return <BoardCatalogSnapshotsClient />
}
