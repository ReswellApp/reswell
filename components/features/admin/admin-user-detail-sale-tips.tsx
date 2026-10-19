import Link from "next/link"
import { AdminStatusPill } from "@/components/features/admin/admin-status-pill"
import { adminSaleTipStatusPresentation } from "@/lib/admin/sale-tip-filters"
import { formatAdminUsd } from "@/lib/admin/admin-user-detail-display"
import { listingDetailHref } from "@/lib/listing-href"
import type { AdminUserSaleTip } from "@/lib/types/adminSaleTips"
import { formatBusinessDateTime } from "@/lib/utils/business-timezone"

interface AdminUserDetailSaleTipsProps {
  userId: string
  tips: AdminUserSaleTip[]
}

export function AdminUserDetailSaleTips({ userId, tips }: AdminUserDetailSaleTipsProps) {
  const paid = tips.filter((tip) => tip.status === "succeeded")
  const paidCents = paid.reduce((sum, tip) => sum + tip.amountCents, 0)

  return (
    <section className="admin-surface overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-headline text-sm font-semibold text-foreground">Platform tips</h2>
          <p className="text-xs text-muted-foreground">
            {paid.length > 0
              ? `${paid.length} paid · ${formatAdminUsd(paidCents / 100)} to Reswell`
              : "No paid tip to Reswell yet"}
          </p>
        </div>
        <Link
          href={`/admin/sale-tips?seller=${userId}&status=all`}
          className="text-xs font-medium text-[hsl(var(--admin-teal))] hover:underline"
        >
          Open tip ledger
        </Link>
      </div>
      {tips.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          This user has not started a seller tip.
        </p>
      ) : (
        <ul className="divide-y divide-border/70">
          {tips.map((tip) => {
            const status = adminSaleTipStatusPresentation(tip.status)
            return (
              <li key={tip.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <Link
                    href={listingDetailHref({ id: tip.listingId, slug: tip.listingSlug })}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {tip.listingTitle || "Listing"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatBusinessDateTime(tip.succeededAt ?? tip.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <AdminStatusPill label={status.label} tone={status.tone} />
                  <span className="w-20 text-right text-sm tabular-nums">
                    {formatAdminUsd(tip.amountCents / 100)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
