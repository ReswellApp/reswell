import Link from 'next/link'
import { AdminStatusPill } from '@/components/features/admin/admin-status-pill'
import { formatAdminUsd } from '@/lib/admin/admin-user-detail-display'
import { formatBusinessDate } from '@/lib/utils/business-timezone'
import type { AdminUserRecentOrder } from '@/lib/services/adminUserDetail'

interface AdminUserDetailOrdersProps {
  orders: AdminUserRecentOrder[]
}

export function AdminUserDetailOrders({ orders }: AdminUserDetailOrdersProps) {
  return (
    <section className="admin-surface overflow-hidden">
      <div className="border-b border-border/70 px-5 py-4">
        <h2 className="font-headline text-sm font-semibold text-foreground">Recent orders</h2>
        <p className="text-xs text-muted-foreground">Latest checkout activity as buyer or seller</p>
      </div>
      {orders.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No checkout orders yet.</p>
      ) : (
        <ul className="divide-y divide-border/70">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <Link href={`/admin/orders/${order.id}`} className="text-sm font-medium hover:underline">
                  {order.orderNum || order.id.slice(0, 8)}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {order.listingTitle || 'Listing'} · {formatBusinessDate(order.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <AdminStatusPill
                  label={order.role === 'seller' ? 'Sold' : 'Bought'}
                  tone={order.role === 'seller' ? 'green' : 'blue'}
                />
                <AdminStatusPill status={order.status} />
                <span className="w-20 text-right text-sm tabular-nums">
                  {formatAdminUsd(order.merchandiseAmount)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
