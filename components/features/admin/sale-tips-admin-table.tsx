import Link from "next/link"
import { AdminStatusPill } from "@/components/features/admin/admin-status-pill"
import {
  ADMIN_SALE_TIP_PAGE_SIZE,
  adminSaleTipListHref,
  adminSaleTipStatusPresentation,
  type AdminSaleTipStatus,
} from "@/lib/admin/sale-tip-filters"
import { formatAdminUsd } from "@/lib/admin/admin-user-detail-display"
import { listingDetailHref } from "@/lib/listing-href"
import type { AdminSaleTipDirectory } from "@/lib/types/adminSaleTips"
import { formatBusinessDateTime } from "@/lib/utils/business-timezone"

const STATUS_OPTIONS: { value: AdminSaleTipStatus | "all"; label: string }[] = [
  { value: "succeeded", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "canceled", label: "Canceled" },
  { value: "all", label: "All statuses" },
]

interface SaleTipsAdminTableProps {
  directory: AdminSaleTipDirectory
}

export function SaleTipsAdminTable({ directory }: SaleTipsAdminTableProps) {
  const { items, total, page, filters, sellerFilter } = directory
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_SALE_TIP_PAGE_SIZE))
  const sellerLabel = sellerFilter?.displayName || sellerFilter?.email || sellerFilter?.id

  return (
    <div className="space-y-4">
      <form action="/admin/sale-tips" className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {filters.sellerUserId ? (
          <input type="hidden" name="seller" value={filters.sellerUserId} />
        ) : null}
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Name, email, listing, or payment id"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-sm"
        />
        <select
          name="status"
          defaultValue={filters.status}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-lg bg-foreground px-4 text-sm text-primary-foreground"
        >
          Apply
        </button>
        {filters.q || filters.status !== "succeeded" || filters.sellerUserId ? (
          <Link href="/admin/sale-tips" className="text-sm text-muted-foreground hover:text-foreground">
            Reset
          </Link>
        ) : null}
      </form>

      {sellerFilter ? (
        <p className="text-sm text-muted-foreground">
          Showing tips from{" "}
          <Link href={`/admin/users/${sellerFilter.id}`} className="font-medium text-foreground hover:underline">
            {sellerLabel}
          </Link>
          .
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2 font-medium">Seller</th>
              <th className="px-3 py-2 font-medium">Listing</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Stripe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((tip) => {
              const status = adminSaleTipStatusPresentation(tip.status)
              const sellerName = tip.sellerDisplayName || tip.sellerEmail || "User"
              return (
                <tr key={tip.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/admin/users/${tip.sellerUserId}`} className="font-medium hover:underline">
                      {sellerName}
                    </Link>
                    {tip.sellerEmail && tip.sellerDisplayName ? (
                      <p className="text-xs text-muted-foreground">{tip.sellerEmail}</p>
                    ) : null}
                  </td>
                  <td className="max-w-[16rem] px-3 py-2">
                    <Link
                      href={listingDetailHref({ id: tip.listingId, slug: tip.listingSlug })}
                      className="line-clamp-2 hover:underline"
                    >
                      {tip.listingTitle || "Listing"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatAdminUsd(tip.amountCents / 100)}</td>
                  <td className="px-3 py-2">
                    <AdminStatusPill label={status.label} tone={status.tone} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatBusinessDateTime(tip.succeededAt ?? tip.createdAt)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {tip.stripePaymentIntentId}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {items.length === 0 ? (
          <p className="px-3 py-8 text-sm text-muted-foreground">No tips match these filters.</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          {total} tip{total === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-3">
          {page > 1 ? (
            <Link
              href={adminSaleTipListHref({ ...filters, seller: filters.sellerUserId ?? "", page: page - 1 })}
              className="hover:text-foreground"
            >
              Previous
            </Link>
          ) : (
            <span>Previous</span>
          )}
          <span>
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={adminSaleTipListHref({ ...filters, seller: filters.sellerUserId ?? "", page: page + 1 })}
              className="hover:text-foreground"
            >
              Next
            </Link>
          ) : (
            <span>Next</span>
          )}
        </div>
      </div>
    </div>
  )
}
