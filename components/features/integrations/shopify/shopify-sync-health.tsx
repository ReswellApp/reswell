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

  const facts: Array<{ label: string; value: React.ReactNode; alert?: boolean }> = [
    {
      label: "Last Shopify update",
      value: <Timestamp iso={connection.last_webhook_at} empty="None yet" />,
    },
    {
      label: "Last full sync",
      value: <Timestamp iso={connection.last_reconciled_at} empty="Not run yet" />,
    },
  ]
  if (queueValue) {
    facts.push({
      label: "Queue",
      value: queueValue,
      alert: Boolean(health && health.deadJobs > 0),
    })
  }
  if (salesValue) {
    facts.push({ label: "Sales to stock", value: salesValue })
  }

  return (
    <dl className="grid grid-cols-2 lg:flex lg:items-stretch">
      {facts.map((fact, index) => (
        <div
          key={fact.label}
          className={cn(
            "min-w-0 py-1 lg:flex-1 lg:py-0",
            index % 2 === 0 ? "pr-4" : "border-l border-[#e3e3e3] pl-4 dark:border-border",
            index >= 2 &&
              "mt-3 border-t border-[#e3e3e3] pt-3 lg:mt-0 lg:border-t-0 lg:pt-0 dark:border-border",
            index === 0 && "lg:pl-0 lg:pr-6",
            index > 0 && "lg:border-l lg:border-[#e3e3e3] lg:px-6 dark:lg:border-border",
          )}
        >
          <dt className="text-[12px] leading-4 text-[#616161] dark:text-muted-foreground">
            {fact.label}
          </dt>
          <dd
            className={cn(
              "mt-1 text-[15px] font-semibold leading-5 text-[#303030] dark:text-foreground",
              fact.alert && "text-[#8e1f0b] dark:text-red-300",
            )}
          >
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
