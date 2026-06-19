import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { verifyPosReceiptToken } from "@/lib/services/posReceiptToken"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"

export const dynamic = "force-dynamic"

type ReceiptOrder = {
  id: string
  order_num: string | null
  amount: number | string
  created_at: string
  sales_channel: string | null
  listings: {
    title: string | null
    listing_images: { url: string; is_primary: boolean | null; sort_order: number | null }[] | null
  } | null
  consignment_stores: { name: string } | null
  store_customers: { first_name: string | null; last_name: string | null; email: string | null } | null
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const verified = verifyPosReceiptToken(token)
  if (!verified.ok) {
    notFound()
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    notFound()
  }

  const { data, error } = await service
    .from("orders")
    .select(
      "id, order_num, amount, created_at, sales_channel, listings (title, listing_images (url, is_primary, sort_order)), consignment_stores (name), store_customers (first_name, last_name, email)",
    )
    .eq("id", verified.orderId)
    .maybeSingle()

  if (error || !data) {
    notFound()
  }
  const order = data as unknown as ReceiptOrder

  const images = order.listings?.listing_images ?? []
  const cover =
    images.find((img) => img.is_primary) ??
    [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0] ??
    null

  const amount = Number(order.amount)
  const date = new Date(order.created_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
  const customerName = [order.store_customers?.first_name, order.store_customers?.last_name]
    .filter(Boolean)
    .join(" ")
  const customerEmail = order.store_customers?.email ?? null

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="text-center">
          <p className="text-lg font-semibold tracking-tight">Reswell</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.consignment_stores?.name ?? "In-store"} · Receipt
          </p>
        </div>

        <div className="mt-6 flex items-center gap-4 border-y py-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
            {cover?.url ? (
              <Image
                src={cover.url}
                alt={order.listings?.title ?? "Board"}
                fill
                sizes="64px"
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-tight">{order.listings?.title ?? "Board"}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Consignment board</p>
          </div>
          <p className="font-semibold tabular-nums">${amount.toFixed(2)}</p>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total paid</dt>
            <dd className="font-semibold tabular-nums">${amount.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Order</dt>
            <dd className="tabular-nums">{formatOrderNumForCustomer(order.order_num, order.id)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Date</dt>
            <dd>{date}</dd>
          </div>
          {customerName ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Customer</dt>
              <dd>{customerName}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Payment</dt>
            <dd>In-store card</dd>
          </div>
        </dl>

        {customerEmail ? (
          <div className="mt-6 rounded-lg bg-muted/50 p-4 text-center">
            <p className="text-sm font-medium">Want to track your gear and shop online?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a free Reswell account with {customerEmail}.
            </p>
            <Link
              href={`/auth/sign-up?email=${encodeURIComponent(customerEmail)}`}
              className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Create account
            </Link>
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Thanks for shopping at {order.consignment_stores?.name ?? "our shop"}.
        </p>
      </div>
    </div>
  )
}
