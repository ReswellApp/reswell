import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { listingDetailHref } from "@/lib/listing-href"
import type { SellerBalanceSheetPage } from "@/lib/types/sellerBalanceSheet"

interface BalanceSheetTableProps {
  sheet: SellerBalanceSheetPage
}

function usd(value: number | null): string {
  if (value == null) return "Not added"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function soldDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso))
}

function profitClass(profit: number | null): string {
  if (profit == null) return "text-muted-foreground"
  return profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
}

export function BalanceSheetTable({ sheet }: BalanceSheetTableProps) {
  return (
    <div className="space-y-4">
      <div className="hidden overflow-hidden rounded-xl border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Listing</th>
              <th className="px-4 py-3 font-medium">Sold</th>
              <th className="px-4 py-3 text-right font-medium">Paid</th>
              <th className="px-4 py-3 text-right font-medium">Sold for</th>
              <th className="px-4 py-3 text-right font-medium">Fee</th>
              <th className="px-4 py-3 text-right font-medium">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sheet.entries.map((entry) => (
              <tr key={entry.entryKey} className="bg-card">
                <td className="max-w-[280px] px-4 py-3">
                  <Link
                    href={listingDetailHref({
                      id: entry.listingId,
                      slug: entry.listingSlug,
                      section: entry.listingSection,
                    })}
                    className="font-medium hover:underline"
                  >
                    {entry.listingTitle}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {entry.purchasedFrom || "Purchase source not added"}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p>{soldDate(entry.soldAt)}</p>
                  <Badge variant="outline" className="mt-1 font-normal">
                    {entry.saleSource === "reswell" ? "Reswell" : "Off-platform"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{usd(entry.purchasePrice)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{usd(entry.soldPrice)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{usd(entry.reswellFee)}</td>
                <td className={`px-4 py-3 text-right font-semibold tabular-nums ${profitClass(entry.profit)}`}>
                  {usd(entry.profit)}
                  {entry.profitMarginPercent != null ? (
                    <span className="ml-1 block text-xs font-normal">
                      {entry.profitMarginPercent.toFixed(1)}%
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {sheet.entries.map((entry) => (
          <Card key={entry.entryKey}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={listingDetailHref({ id: entry.listingId, slug: entry.listingSlug })}
                  className="font-semibold hover:underline"
                >
                  {entry.listingTitle}
                </Link>
                <Badge variant="outline">
                  {entry.saleSource === "reswell" ? "Reswell" : "Off-platform"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Sold {soldDate(entry.soldAt)}
                {entry.purchasedFrom ? ` · Bought from ${entry.purchasedFrom}` : ""}
              </p>
              <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                <div><dt className="text-muted-foreground">Paid</dt><dd className="tabular-nums">{usd(entry.purchasePrice)}</dd></div>
                <div><dt className="text-muted-foreground">Sold for</dt><dd className="tabular-nums">{usd(entry.soldPrice)}</dd></div>
                <div><dt className="text-muted-foreground">Fee</dt><dd className="tabular-nums">{usd(entry.reswellFee)}</dd></div>
                <div><dt className="text-muted-foreground">Profit</dt><dd className={`font-semibold tabular-nums ${profitClass(entry.profit)}`}>{usd(entry.profit)}</dd></div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      {sheet.totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {sheet.page} of {sheet.totalPages}
          </p>
          <div className="flex gap-2">
            {sheet.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/balance-sheet?page=${sheet.page - 1}`}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Previous
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <ArrowLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
            )}
            {sheet.page < sheet.totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/balance-sheet?page=${sheet.page + 1}`}>
                  Next <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Next <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
