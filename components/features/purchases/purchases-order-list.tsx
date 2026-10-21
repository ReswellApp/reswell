"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PurchaseOrderRow } from "@/components/features/purchases/purchase-order-row"
import {
  purchaseCountLabel,
  purchaseMatchesQuery,
  type PurchaseListItem,
} from "@/lib/purchases-list-display"

const purchaseCountClass = "text-[22px] font-medium leading-none text-slate-400 dark:text-slate-500"

interface PurchasesOrderListProps {
  items: PurchaseListItem[]
}

export function PurchasesOrderList({ items }: PurchasesOrderListProps) {
  const [query, setQuery] = useState("")
  const visible = useMemo(
    () => items.filter((item) => purchaseMatchesQuery(item, query)),
    [items, query],
  )
  const searching = query.trim().length > 0

  return (
    <div className="space-y-5">
      <p className={purchaseCountClass} aria-live="polite">
        {purchaseCountLabel(searching ? visible.length : items.length)}
      </p>

      {items.length > 0 ? (
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="title, seller or order #"
          aria-label="Search purchases by title, seller, or order number"
          aria-controls="purchases-list"
          spellCheck={false}
          autoComplete="off"
          className="h-12 rounded-full border-2 border-blue-500 bg-background px-5 text-base shadow-none placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:ring-offset-0 dark:border-blue-400 dark:focus-visible:border-blue-400 md:text-[15px]"
        />
      ) : null}

      {items.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <Receipt className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden />
          <p className="mb-4 max-w-sm text-muted-foreground">
            When you buy from other members, your orders show up here.
          </p>
          <Button asChild>
            <Link href="/gear">Browse gear</Link>
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No purchases match that search.
        </p>
      ) : (
        <ul id="purchases-list" className="pt-2">
          {visible.map((item, index) => (
            <PurchaseOrderRow key={item.id} item={item} imagePriority={index === 0} />
          ))}
        </ul>
      )}
    </div>
  )
}
