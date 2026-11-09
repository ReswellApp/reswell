"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ListingDeskTableRow,
  type ListingDeskTableListing,
} from "@/components/features/dashboard/listings/listing-desk-table-row"
import type { ListingQuickEditSaved } from "@/lib/services/listingQuickEdit"
import type { ShopPackageSizeId } from "@/lib/shop-category-package-sizes"
import { cn } from "@/lib/utils"

const ROW_PAGE_OPTIONS = ["25", "50", "100", "200"] as const

interface ListingDeskTableProps {
  listings: ListingDeskTableListing[]
  listedSort: "recent" | "oldest"
  onListedSortChange: (sort: "recent" | "oldest") => void
  onListingSaved: (listingId: string, saved: ListingQuickEditSaved) => void
  onEndListing: (listingId: string) => void
  onDiscardDraft?: (listingId: string) => void
  packageSyncById?: Record<string, { sizeId: ShopPackageSizeId; nonce: number }>
}

export function ListingDeskTable({
  listings,
  listedSort,
  onListedSortChange,
  onListingSaved,
  onEndListing,
  onDiscardDraft,
  packageSyncById = {},
}: ListingDeskTableProps) {
  const router = useRouter()
  const [rowsPerPage, setRowsPerPage] = useState<string>("50")
  const [page, setPage] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const pageSize = Number(rowsPerPage) || 50
  const pageCount = Math.max(1, Math.ceil(listings.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)

  const pageRows = useMemo(() => {
    const start = safePage * pageSize
    return listings.slice(start, start + pageSize)
  }, [listings, pageSize, safePage])

  const countLabel =
    listings.length === 1 ? "1 listing" : `${listings.length.toLocaleString()} listings`

  async function handleRefresh() {
    setRefreshing(true)
    try {
      router.refresh()
    } finally {
      window.setTimeout(() => setRefreshing(false), 400)
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="listings-desk-table-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="listings-desk-table-heading" className="text-base font-semibold text-foreground">
            Edit listings
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Price, condition, package, and description save as you edit. Photos open the full editor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Rows per page</span>
            <Select
              value={rowsPerPage}
              onValueChange={(value) => {
                setRowsPerPage(value)
                setPage(0)
              }}
            >
              <SelectTrigger className="h-9 w-[4.5rem] rounded-md text-[13px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROW_PAGE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-md text-[13px]"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden />
            Refresh
          </Button>
          <p className="text-[13px] text-muted-foreground">{countLabel}</p>
        </div>
      </div>

      {listings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No listings match this view.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
          <table className="min-w-[68rem] w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border/80 bg-muted/30 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2.5 font-semibold normal-case tracking-normal">
                  Photos
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold normal-case tracking-normal">
                  Title / Brand
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold normal-case tracking-normal">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() =>
                      onListedSortChange(listedSort === "recent" ? "oldest" : "recent")
                    }
                  >
                    Listed
                    {listedSort === "recent" ? (
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold normal-case tracking-normal">
                  Condition
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold normal-case tracking-normal">
                  Package / Weight
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold normal-case tracking-normal">
                  Price
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold normal-case tracking-normal">
                  Seller description
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold normal-case tracking-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((listing) => {
                const sync = packageSyncById[listing.id]
                return (
                  <ListingDeskTableRow
                    key={listing.id}
                    listing={listing}
                    appliedPackageSizeId={sync?.sizeId ?? null}
                    packageSyncNonce={sync?.nonce ?? 0}
                    onSaved={onListingSaved}
                    onEndListing={onEndListing}
                    onDiscardDraft={onDiscardDraft}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {listings.length > pageSize ? (
        <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
          <p>
            Showing {safePage * pageSize + 1}–
            {Math.min((safePage + 1) * pageSize, listings.length)} of {listings.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-md"
              disabled={safePage <= 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-md"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
