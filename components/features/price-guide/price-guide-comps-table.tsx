import Link from "next/link"
import { formatGuideUsd } from "@/lib/price-guide/format"
import type { PriceGuideComp } from "@/lib/types/price-guide"

type PriceGuideCompsTableProps = {
  comps: PriceGuideComp[]
  emptyLabel?: string
}

export function PriceGuideCompsTable({
  comps,
  emptyLabel = "No public comps yet — we’re still collecting sales.",
}: PriceGuideCompsTableProps) {
  if (comps.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Sold</th>
            <th className="px-4 py-3 font-medium">Price</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Condition</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Details</th>
            <th className="px-4 py-3 font-medium">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {comps.map((comp) => (
            <tr key={comp.id} className="bg-background">
              <td className="px-4 py-3 tabular-nums text-muted-foreground">{comp.sold_at}</td>
              <td className="px-4 py-3 font-semibold tabular-nums text-foreground">
                {formatGuideUsd(comp.sold_price_usd)}
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                {comp.condition_label ?? "—"}
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                <span className="line-clamp-1">{comp.dimensions || comp.title || "—"}</span>
              </td>
              <td className="px-4 py-3">
                {comp.listing_url ? (
                  <Link href={comp.listing_url} className="text-foreground underline-offset-4 hover:underline">
                    {comp.source_label}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{comp.source_label}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
