import Link from "next/link"
import { notFound } from "next/navigation"
import { AdminBoardBuyDetail } from "@/components/features/admin/admin-board-buy-detail"
import { getAdminBoardBuyService } from "@/lib/services/boardBuy"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Buy program quote — Admin — Reswell",
  description: "Review photos and send a quote.",
  path: "/admin/we-buy",
})

export default async function AdminWeBuyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getAdminBoardBuyService(id)
  if ("error" in result) {
    if (result.error === "Not found") notFound()
    return <p className="text-sm text-destructive">{result.error}</p>
  }

  return (
    <div className="space-y-4">
      <Link href="/admin/we-buy" className="text-sm underline">
        Queue
      </Link>
      <AdminBoardBuyDetail submission={result.data} />
    </div>
  )
}
