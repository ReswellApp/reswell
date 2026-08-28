import Link from "next/link"
import { boardBuyStatusLabel } from "@/components/features/board-buy/board-buy-status-label"
import { listAdminBoardBuysService } from "@/lib/services/boardBuy"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Buy program — Admin — Reswell",
  description: "Quote boards Reswell may buy.",
  path: "/admin/we-buy",
})

export default async function AdminWeBuyPage() {
  const result = await listAdminBoardBuysService()
  const rows = "success" in result ? result.data : []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Buy program</h1>
      <p className="text-sm text-muted-foreground">
        Quote within 30 minutes or the seller automatically gets 20% off their asking price.
      </p>
      {"error" in result ? <p className="text-sm text-destructive">{result.error}</p> : null}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2 font-medium">Board</th>
              <th className="px-3 py-2 font-medium">Seller</th>
              <th className="px-3 py-2 font-medium">Ask</th>
              <th className="px-3 py-2 font-medium">Offer</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/admin/we-buy/${row.id}`} className="font-medium underline">
                    {row.title}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {row.sellerDisplayName ?? row.sellerEmail ?? "—"}
                </td>
                <td className="px-3 py-2">${row.askingPrice.toFixed(2)}</td>
                <td className="px-3 py-2">
                  {row.offeredPrice != null ? `$${row.offeredPrice.toFixed(2)}` : "—"}
                </td>
                <td className="px-3 py-2">{boardBuyStatusLabel(row.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-3 py-8 text-sm text-muted-foreground">No submissions yet.</p>
        ) : null}
      </div>
    </div>
  )
}
