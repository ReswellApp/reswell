"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { BoardModelStockDimRow } from "@/lib/index-directory/types"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { BoardModelStockDimsTable } from "@/components/index-directory/board-model-stock-dims-table"
import { cn } from "@/lib/utils"

export function BoardModelStockDimsCollapsible({ rows }: { rows: BoardModelStockDimRow[] }) {
  const [open, setOpen] = useState(false)
  const sizeCount = rows.length

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-center gap-4 px-5 py-5 text-left transition-colors hover:bg-muted/30 sm:px-6 sm:py-5",
            "outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 focus-visible:ring-offset-2",
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <span className="text-sm font-semibold text-foreground">Stock dimensions</span>
            <span className="text-xs tabular-nums text-muted-foreground">{sizeCount} sizes</span>
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/40 px-3 pb-5 pt-1 sm:px-5">
            <BoardModelStockDimsTable rows={rows} />
            <p className="mt-4 px-1 text-[11px] leading-relaxed text-muted-foreground">
              Standard sizes from the manufacturer. Custom options may be available on their site.
            </p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
