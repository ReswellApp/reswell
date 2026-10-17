"use client"

import { formatDistanceToNowLabel, RelativeTime } from "@/components/ui/relative-time"
import type {
  PublicShopifyConnection,
  ShopifySyncHealth,
} from "@/lib/shopify/types"
import { cn } from "@/lib/utils"

interface ShopifySyncStatusLineProps {
  connection: PublicShopifyConnection
  health: ShopifySyncHealth | null
}

function Timestamp({ iso, empty }: { iso: string | null; empty: string }) {
  if (!iso) return <>{empty}</>
  return (
    <RelativeTime iso={iso} formatLabel={formatDistanceToNowLabel} placeholder="—" />
  )
}

function Fact({
  label,
  children,
  alert,
}: {
  label: string
  children: React.ReactNode
  alert?: boolean
}) {
  return (
    <span>
      {label}{" "}
      <span
        className={cn(
          "font-medium text-[#202223] dark:text-foreground",
          alert && "text-[#d72c0d] dark:text-red-400",
        )}
      >
        {children}
      </span>
    </span>
  )
}

export function ShopifySyncStatusLine({
  connection,
  health,
}: ShopifySyncStatusLineProps) {
  const backlog = health ? health.queuedJobs + health.retryJobs : 0
  const queueValue = !health
    ? null
    : health.deadJobs > 0
      ? `${health.deadJobs} failed after retries`
      : backlog === 0
        ? "Up to date"
        : `${backlog} pending${health.retryJobs > 0 ? ` · ${health.retryJobs} retrying` : ""}`
  const salesValue = !health
    ? null
    : health.pendingInventoryWrites > 0
      ? `${health.inventoryWritesEnabled ? "On" : "Off"} · ${health.pendingInventoryWrites} waiting`
      : health.inventoryWritesEnabled
        ? "On"
        : "Off"

  return (
    <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] leading-5 text-[#6d7175] dark:text-muted-foreground">
      <Fact label="Last Shopify update">
        <Timestamp iso={connection.last_webhook_at} empty="None yet" />
      </Fact>
      <span aria-hidden>·</span>
      <Fact label="Last full sync">
        <Timestamp iso={connection.last_reconciled_at} empty="Not run yet" />
      </Fact>
      {queueValue ? (
        <>
          <span aria-hidden>·</span>
          <Fact label="Queue" alert={Boolean(health && health.deadJobs > 0)}>
            {queueValue}
          </Fact>
        </>
      ) : null}
      {salesValue ? (
        <>
          <span aria-hidden>·</span>
          <Fact label="Sales → stock">{salesValue}</Fact>
        </>
      ) : null}
    </p>
  )
}
