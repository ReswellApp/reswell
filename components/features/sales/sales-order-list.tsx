"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import { PackageCheck } from "lucide-react"
import { SaleOrderRow } from "@/components/features/sales/sale-order-row"
import { SalesFulfillmentFilters } from "@/components/features/sales/sales-fulfillment-filters"
import { purchaseSearchFieldClassName } from "@/components/features/purchases/purchase-brand-styles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { SalesListFilter } from "@/lib/sale-fulfillment-filters"
import { saleCountLabel, saleMatchesQuery, type SaleListItem } from "@/lib/sales-list-display"
import { cn } from "@/lib/utils"

const saleCountClass = "text-[22px] font-medium leading-none text-slate-400 dark:text-slate-500"

interface SalesOrderListProps {
  items: SaleListItem[]
  hasAnySales: boolean
  filterEmptyMessage: string | null
  activeFilter: SalesListFilter
  pendingShipmentCount: number
  pendingPickupCount: number
  showFulfillmentGroups: boolean
}

export function SalesOrderList({
  items,
  hasAnySales,
  filterEmptyMessage,
  activeFilter,
  pendingShipmentCount,
  pendingPickupCount,
  showFulfillmentGroups,
}: SalesOrderListProps) {
  const [query, setQuery] = useState("")
  const visible = useMemo(
    () => items.filter((item) => saleMatchesQuery(item, query)),
    [items, query],
  )
  const searching = query.trim().length > 0

  return (
    <div className="space-y-5">
      <p className={saleCountClass} aria-live="polite">
        {saleCountLabel(searching ? visible.length : items.length)}
      </p>

      {hasAnySales ? (
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="title, buyer or order #"
          aria-label="Search sales by title, buyer, or order number"
          aria-controls="sales-list"
          spellCheck={false}
          autoComplete="off"
          className={cn(
            "h-12 rounded-full border-2 bg-background px-5 text-base shadow-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-offset-0 md:text-[15px]",
            purchaseSearchFieldClassName,
          )}
        />
      ) : null}

      {hasAnySales ? (
        <SalesFulfillmentFilters
          activeFilter={activeFilter}
          pendingShipmentCount={pendingShipmentCount}
          pendingPickupCount={pendingPickupCount}
        />
      ) : null}

      {!hasAnySales ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <PackageCheck className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden />
          <p className="mb-4 max-w-sm text-muted-foreground">
            When someone buys your gear, the sale shows up here with fulfillment details.
          </p>
          <Button asChild>
            <Link href="/sell?new=1">Create a listing</Link>
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {filterEmptyMessage ?? "No sales match this filter."}
        </p>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No sales match that search.</p>
      ) : (
        <ul id="sales-list" className="pt-2">
          {visible.map((item, index) => {
            const previous = index > 0 ? visible[index - 1] : undefined
            const showOpenHeading = showFulfillmentGroups && item.needsFulfillment && index === 0
            const showEarlierHeading =
              showFulfillmentGroups &&
              !item.needsFulfillment &&
              (index === 0 || Boolean(previous?.needsFulfillment))
            return (
              <Fragment key={item.id}>
                {showOpenHeading ? (
                  <li className="list-none pb-1 text-sm font-semibold text-foreground">Needs fulfillment</li>
                ) : null}
                {showEarlierHeading ? (
                  <li className="list-none pb-1 pt-2 text-sm font-semibold text-muted-foreground">
                    Earlier sales
                  </li>
                ) : null}
                <SaleOrderRow item={item} imagePriority={index === 0} />
              </Fragment>
            )
          })}
        </ul>
      )}
    </div>
  )
}
