'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Scale, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SHIPENGINE_WALLET_CARRIERS } from '@/lib/shipengine/reswell-carriers'

type ReswellUpsCarrierStatusProps = {
  carriers: Record<string, unknown>[]
  className?: string
  /** When set, the primary action switches tabs instead of linking. */
  onOpenRates?: () => void
}

function connectedCarrierIds(carriers: Record<string, unknown>[]): Set<string> {
  const ids = new Set<string>()
  for (const carrier of carriers) {
    const id = carrier.carrier_id
    if (typeof id === 'string' && id.trim()) ids.add(id.trim())
  }
  return ids
}

export function ReswellUpsCarrierStatus({
  carriers,
  className,
  onOpenRates,
}: ReswellUpsCarrierStatusProps) {
  const connectedIds = connectedCarrierIds(carriers)
  const rows = SHIPENGINE_WALLET_CARRIERS.map((carrier) => ({
    ...carrier,
    connected: connectedIds.has(carrier.id),
  }))
  const connectedCount = rows.filter((row) => row.connected).length
  const allConnected = connectedCount === rows.length

  return (
    <Card className={cn('rounded-2xl border-border bg-card', className)}>
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                allConnected
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              )}
            >
              {allConnected ? <Scale className="h-4 w-4" aria-hidden /> : <TriangleAlert className="h-4 w-4" aria-hidden />}
            </span>
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold tracking-tight">ShipEngine carriers</CardTitle>
              <CardDescription className="text-sm">
                Quotes and labels use only these One Balance accounts.
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-medium',
              allConnected
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400',
            )}
          >
            {allConnected ? 'Connected' : `${connectedCount} of ${rows.length}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{row.label}</p>
                <p className="mt-0.5 font-mono text-[12px] text-muted-foreground">{row.id}</p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                  row.connected
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                    : 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400',
                )}
              >
                {row.connected ? 'Connected' : 'Not found'}
              </Badge>
            </li>
          ))}
        </ul>
        {onOpenRates ? (
          <Button type="button" className="h-10 rounded-xl" onClick={onOpenRates}>
            Open shipping rates
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
