"use client"

import { Activity, ArrowDownToLine, Clock, ListChecks } from "lucide-react"
import { formatDistanceToNowLabel, RelativeTime } from "@/components/ui/relative-time"
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

function Tile({
  icon: Icon,
  label,
  children,
  detail,
  alert,
}: {
  icon: typeof Activity
  label: string
  children: React.ReactNode
  detail: string
  alert?: boolean
}) {
  return (
    <div className="flex gap-3 rounded-lg border p-3">
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground",
          alert && "text-red-600 dark:text-red-400",
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{children}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}

export function ShopifySyncHealthTiles({ connection, health }: ShopifySyncHealthProps) {
  const backlog = health.queuedJobs + health.retryJobs
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile icon={Activity} label="Last Shopify update" detail="Product, stock, and delete notices">
        <Timestamp iso={connection.last_webhook_at} empty="None received yet" />
      </Tile>
      <Tile icon={Clock} label="Last full sync" detail="Runs every 6 hours, or with Sync now">
        <Timestamp iso={connection.last_reconciled_at} empty="Not run yet" />
      </Tile>
      <Tile
        icon={ListChecks}
        label="Sync queue"
        alert={health.deadJobs > 0}
        detail={
          health.deadJobs > 0
            ? `${health.deadJobs} failed after retries`
            : "Deleted Shopify products are removed automatically"
        }
      >
        {backlog === 0 ? "Up to date" : `${backlog} pending`}
        {health.retryJobs > 0 ? ` · ${health.retryJobs} retrying` : ""}
      </Tile>
      <Tile
        icon={ArrowDownToLine}
        label="Reswell sales → Shopify stock"
        detail={
          health.pendingInventoryWrites > 0
            ? `${health.pendingInventoryWrites} sale${health.pendingInventoryWrites === 1 ? "" : "s"} waiting to update Shopify`
            : "Sold items lower Shopify inventory when on"
        }
      >
        {health.inventoryWritesEnabled ? "On" : "Off"}
      </Tile>
    </div>
  )
}
