'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, RefreshCw, Target } from 'lucide-react'
import type { SiteTrafficDashboardRow } from '@/lib/types/siteTraffic'

export function ReswellGoalsAdminClient() {
  const [data, setData] = useState<SiteTrafficDashboardRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialAttemptDoneRef = useRef(false)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    setError(null)
    const firstEver = !initialAttemptDoneRef.current
    if (firstEver) setLoading(true)
    else if (!opts?.silent) setRefreshing(true)
    try {
      const res = await fetch('/api/admin/site-traffic?months=36', {
        credentials: 'include',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Could not load site traffic.')
        setData(null)
        return
      }
      if (body.data && typeof body.data === 'object') {
        setData(body.data as SiteTrafficDashboardRow)
      } else {
        setError('Invalid response from server')
        setData(null)
      }
    } catch {
      setError('Could not load site traffic.')
      setData(null)
    } finally {
      if (firstEver) {
        setLoading(false)
        initialAttemptDoneRef.current = true
      } else if (!opts?.silent) {
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const fmt = (n: number) => n.toLocaleString()

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-8 w-8 text-neutral-800" aria-hidden />
            Reswell goals
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Unique visitors and page views from in-app navigation (same events as the Klaviyo page-view
            tracker). Admin routes are not counted.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Marketplace search volume lives in{' '}
            <Link href="/admin/search-analytics" className="text-primary underline underline-offset-2">
              Search analytics
            </Link>
            .
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load({ silent: false })}
          disabled={refreshing || loading}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading traffic…
        </p>
      )}

      {data && !loading && (
        <Tabs defaultValue="7d" className="w-full space-y-6">
          <TabsList>
            <TabsTrigger value="7d">Past 7 days</TabsTrigger>
            <TabsTrigger value="30d">Past 30 days</TabsTrigger>
            <TabsTrigger value="months">By month</TabsTrigger>
          </TabsList>

          <TabsContent value="7d" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <MetricCard title="Unique visitors" value={fmt(data.last7Days.uniqueVisitors)} />
              <MetricCard title="Page views" value={fmt(data.last7Days.pageViews)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Rolling window ending now. Visitors are distinct keys: signed-in users by account id, or
              anonymous browsers by the id stored in localStorage.
            </p>
          </TabsContent>

          <TabsContent value="30d" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <MetricCard title="Unique visitors" value={fmt(data.last30Days.uniqueVisitors)} />
              <MetricCard title="Page views" value={fmt(data.last30Days.pageViews)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Same definitions as the seven-day view, over thirty rolling days.
            </p>
          </TabsContent>

          <TabsContent value="months" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Visitors and page views by calendar month</CardTitle>
                <CardDescription>
                  Calendar buckets in UTC. The current month accumulates until it closes. Showing up to
                  thirty-six months of history where data exists.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-0">
                <div className="overflow-x-auto px-6 pb-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Unique visitors</TableHead>
                        <TableHead className="text-right">Page views</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byMonth.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-muted-foreground">
                            No rows yet — data appears after migrations are applied and browsers send page
                            views.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.byMonth.map((row) => (
                          <TableRow key={row.monthStart}>
                            <TableCell className="font-medium">{row.monthLabel}</TableCell>
                            <TableCell className="text-right">{fmt(row.uniqueVisitors)}</TableCell>
                            <TableCell className="text-right">{fmt(row.pageViews)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
