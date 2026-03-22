'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, Loader2, RefreshCw, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type LiveUser = {
  id: string
  display_name: string | null
  email: string | null
  last_active_at: string | null
}

type LiveStatsPayload = {
  activeNow: number
  last15Minutes: number
  lastHour: number
  activeUsers: LiveUser[]
  windows: { activeNowMinutes: number; recentMinutes: number; hourMinutes: number }
  fetchedAt: string
}

export default function AdminLivePage() {
  const [data, setData] = useState<LiveStatsPayload | null>(null)
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
      const res = await fetch('/api/admin/live-stats', { credentials: 'include' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Could not load live stats')
        setData(null)
        return
      }
      setData(body as LiveStatsPayload)
    } catch {
      setError('Could not load live stats')
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
    const id = setInterval(() => void load({ silent: true }), 10_000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-8 w-8 text-neutral-800" />
            Live activity
          </h1>
          <p className="text-muted-foreground mt-1">
            Signed-in users who have the site open send a heartbeat about every minute. “Active now” counts
            anyone seen in the last {data?.windows.activeNowMinutes ?? 3} minutes.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load({ silent: false })} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active now</CardTitle>
            <Activity className="h-4 w-4 text-neutral-800" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.activeNow ?? '—'}</div>
            <p className="text-xs text-muted-foreground">
              Last {data?.windows.activeNowMinutes ?? 3} min
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.last15Minutes ?? '—'}</div>
            <p className="text-xs text-muted-foreground">
              Last {data?.windows.recentMinutes ?? 15} min
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last hour</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.lastHour ?? '—'}</div>
            <p className="text-xs text-muted-foreground">
              Last {data?.windows.hourMinutes ?? 60} min
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Users active now</CardTitle>
          {data?.fetchedAt && (
            <p className="text-xs text-muted-foreground font-normal">
              Updated {formatDistanceToNow(new Date(data.fetchedAt), { addSuffix: true })}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : !data?.activeUsers?.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No users in the “active now” window. After you run migration{' '}
              <code className="text-xs bg-muted px-1 rounded">028_profiles_last_active_at.sql</code>
              , signed-in visitors will appear here within about a minute.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activeUsers.map((u) => (
                    <tr key={u.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-4">{u.display_name?.trim() || '—'}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{u.email || '—'}</td>
                      <td className="py-2 whitespace-nowrap">
                        {u.last_active_at
                          ? formatDistanceToNow(new Date(u.last_active_at), { addSuffix: true })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
