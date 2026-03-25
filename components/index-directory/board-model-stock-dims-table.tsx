import type { BoardModelStockDimRow } from "@/lib/index-directory/types"
import { cn } from "@/lib/utils"

export function BoardModelStockDimsTable({
  rows,
  className,
}: {
  rows: BoardModelStockDimRow[]
  className?: string
}) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border/40 bg-muted/10", className)}>
      <table className="w-full min-w-[18rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-background/80">
            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-4 sm:py-3">
              Length
            </th>
            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-4 sm:py-3">
              Width
            </th>
            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-4 sm:py-3">
              Thickness
            </th>
            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-4 sm:py-3">
              Vol.
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if ("raw" in row) {
              return (
                <tr key={i} className="border-b border-border/30 last:border-0">
                  <td colSpan={4} className="px-3 py-2.5 text-muted-foreground sm:px-4 sm:py-3">
                    {row.raw}
                  </td>
                </tr>
              )
            }
            return (
              <tr
                key={i}
                className="border-b border-border/30 last:border-0 transition-colors hover:bg-muted/20"
              >
                <td className="px-3 py-2 tabular-nums text-foreground sm:px-4 sm:py-2.5">{row.length}</td>
                <td className="px-3 py-2 text-foreground sm:px-4 sm:py-2.5">{row.width}</td>
                <td className="px-3 py-2 text-foreground sm:px-4 sm:py-2.5">{row.thickness}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground sm:px-4 sm:py-2.5">{row.volume}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
