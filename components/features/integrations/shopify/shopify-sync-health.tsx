"use client"

import { formatDistanceToNowLabel, RelativeTime } from "@/components/ui/relative-time"
import {
  shopifyDividerClass,
  shopifyMutedClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"
import type {
  PublicShopifyConnection,
  ShopifySyncHealth,
} from "@/lib/shopify/types"
import { cn } from "@/lib/utils"

interface ShopifySyncHealthProps {
  connection: PublicShopifyConnection
  health: ShopifySyncHealth
}

function Timestamp({ iso, empty }: { iso: string | null; empty: string }) {
  if (!iso) return <>{empty}</>
  return (
    <RelativeTime iso={iso} formatLabel={formatDistanceToNowLabel} placeholder="—" />
  )
}

export function ShopifySyncHealthSummary({
  connection,
  health,
}: ShopifySyncHealthProps) {
  const backlog = health.queuedJobs + health.retryJobs
  const facts: Array<{
    label: string
    value: React.ReactNode
    detail: string
    alert?: boolean
  }> = [
    {
      label: "Last Shopify update",
      value: (
        <Timestamp iso={connection.last_webhook_at} empty="None received yet" />
      ),
      detail: "Product, stock, and delete notices",
    },
    {
      label: "Last full sync",
      value: (
        <Timestamp iso={connection.last_reconciled_at} empty="Not run yet" />
      ),
      detail: "Runs every 6 hours, or with Sync now",
    },
    {
      label: "Sync queue",
      value: (
        <>
          {backlog === 0 ? "Up to date" : `${backlog} pending`}
          {health.retryJobs > 0 ? ` · ${health.retryJobs} retrying` : ""}
        </>
      ),
      detail:
        health.deadJobs > 0
          ? `${health.deadJobs} failed after retries`
          : "Deleted Shopify products are removed automatically",
      alert: health.deadJobs > 0,
    },
    {
      label: "Reswell sales → Shopify stock",
      value: health.inventoryWritesEnabled ? "On" : "Off",
      detail:
        health.pendingInventoryWrites > 0
          ? `${health.pendingInventoryWrites} sale${health.pendingInventoryWrites === 1 ? "" : "s"} waiting to update Shopify`
          : "Sold items lower Shopify inventory when on",
    },
  ]

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {facts.map((fact, index) => (
        <div
          key={fact.label}
          className={cn(
            "border-b px-4 py-3 last:border-b-0",
            shopifyDividerClass,
            "sm:border-b-0",
            index % 2 === 0 && "sm:border-r",
            index < 2 && "sm:border-b lg:border-b-0",
            index < facts.length - 1 && "lg:border-r",
          )}
        >
          <dt className={`text-[12px] leading-4 ${shopifyMutedClass}`}>{fact.label}</dt>
          <dd
            className={cn(
              "mt-1 text-[13px] font-semibold leading-5 text-[#202223] dark:text-foreground",
              fact.alert && "text-[#d72c0d] dark:text-red-400",
            )}
          >
            {fact.value}
          </dd>
          <dd className={`mt-0.5 text-[12px] leading-4 ${shopifyMutedClass}`}>
            {fact.detail}
          </dd>
        </div>
      ))}
    </dl>
  )
}
