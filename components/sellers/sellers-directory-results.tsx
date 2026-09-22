"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Store, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  SellersDirectoryGrid,
  type SellerDirectoryGridItem,
} from "@/components/sellers/sellers-directory-grid"
import { useSellersDirectoryQuery } from "@/components/sellers/sellers-directory-query"
import { filterSellersDirectoryCatalog } from "@/lib/sellers/directory-catalog-filter"

type SellersDirectoryFilteredResultsProps = {
  items: SellerDirectoryGridItem[]
  totalInventory: number
}

export function SellersDirectoryFilteredResults({
  items,
  totalInventory,
}: SellersDirectoryFilteredResultsProps) {
  const { query, setQuery } = useSellersDirectoryQuery()
  const filtered = useMemo(
    () => filterSellersDirectoryCatalog({ items, totalInventory }, query),
    [items, query, totalInventory],
  )
  const visible = filtered.items

  return (
    <section className="py-10 sm:py-14">
      <div className="container mx-auto px-4 sm:px-6">
        {visible.length > 0 ? (
          <p className="mx-auto mb-8 inline-flex w-full items-center justify-center gap-1.5 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {visible.length} seller{visible.length !== 1 ? "s" : ""}
              {filtered.totalInventory > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  {filtered.totalInventory} active listing{filtered.totalInventory !== 1 ? "s" : ""}
                </>
              ) : null}
            </span>
          </p>
        ) : null}

        {query ? (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {visible.length} seller{visible.length !== 1 ? "s" : ""} found for “{query}”
            </p>
            <Button variant="ghost" size="sm" type="button" onClick={() => setQuery("")}>
              Clear search
            </Button>
          </div>
        ) : null}

        {visible.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Store className="h-7 w-7 text-muted-foreground" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold text-foreground">No sellers found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {query ? "Try different search terms." : "Check back soon as more sellers join Reswell."}
            </p>
            {!query ? (
              <Button className="mt-6 rounded-full" asChild>
                <Link href="/auth/sign-up">Join Reswell</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <SellersDirectoryGrid items={visible} />
        )}
      </div>
    </section>
  )
}
