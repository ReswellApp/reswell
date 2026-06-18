"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface SyncJob {
  id: string
  type: string
  status: string
  attempts: number
  lastError: string | null
  updatedAt: string
}

interface OrderLink {
  id: string
  reswellOrderId: string
  shopifyOrderName: string | null
  status: string
  lastError: string | null
  createdAt: string
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "succeeded" || status === "created" || status === "fulfilled") return "default"
  if (status === "failed" || status === "dead") return "destructive"
  if (status === "running" || status === "queued" || status === "pending") return "secondary"
  return "outline"
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ShopifyActivityCard() {
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [orders, setOrders] = useState<OrderLink[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/integrations/shopify/activity")
      const json = (await res.json()) as { data?: { jobs: SyncJob[]; orders: OrderLink[] } }
      setJobs(json.data?.jobs ?? [])
      setOrders(json.data?.orders ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Sync activity</CardTitle>
          <CardDescription>Recent background jobs and orders pushed to Shopify.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-medium">Jobs</p>
          {loading && jobs.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : jobs.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No sync jobs yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border text-sm">
              {jobs.slice(0, 10).map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{humanize(job.type)}</p>
                    {job.lastError ? (
                      <p className="truncate text-xs text-destructive">{job.lastError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.updatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Orders pushed to Shopify</p>
          {orders.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No marketplace orders pushed yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border text-sm">
              {orders.slice(0, 10).map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{order.shopifyOrderName ?? "Order pending"}</p>
                    {order.lastError ? (
                      <p className="truncate text-xs text-destructive">{order.lastError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
