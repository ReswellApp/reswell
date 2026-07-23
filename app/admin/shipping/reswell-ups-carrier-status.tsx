'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Scale, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  findReswellUpsCarrier,
  RESWELL_UPS_CARRIER_ID,
  reswellUpsCarrierLabel,
} from '@/lib/shipengine/reswell-carriers'

type ReswellUpsCarrierStatusProps = {
  carriers: Record<string, unknown>[]
  className?: string
  /** When set, the primary action switches tabs instead of linking. */
  onOpenRates?: () => void
}

export function ReswellUpsCarrierStatus({
  carriers,
  className,
  onOpenRates,
}: ReswellUpsCarrierStatusProps) {
  const reswellUps = findReswellUpsCarrier(carriers)
  const connected = reswellUps != null
  const ratesHref = '/admin/shipping?tab=rates'

  return (
    <Card className={cn('rounded-2xl border-border bg-card', className)}>
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                connected
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              )}
            >
              {connected ? <Scale className="h-4 w-4" aria-hidden /> : <TriangleAlert className="h-4 w-4" aria-hidden />}
            </span>
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold tracking-tight">Reswell UPS shipping rates</CardTitle>
              <CardDescription className="text-sm">
                Quote surfboard labels through your connected UPS account in ShipEngine.
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-medium',
              connected
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400',
            )}
          >
            {connected ? 'Connected' : 'Not found'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            Expected carrier ID{' '}
            <code className="rounded-md bg-muted/80 px-1.5 py-0.5 font-mono text-[12px] text-foreground">
              {RESWELL_UPS_CARRIER_ID}
            </code>
          </p>
          {connected ? (
            <p className="mt-2 text-foreground">
              <span className="font-medium">{reswellUpsCarrierLabel(reswellUps)}</span>
              <span className="text-muted-foreground"> · billed on your UPS account (monthly invoice)</span>
            </p>
          ) : (
            <p className="mt-2 text-muted-foreground">
              Connect your UPS account in the ShipEngine dashboard, then refresh this page. Until it appears here,
              surfboard rate quotes will not include your negotiated UPS pricing.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {onOpenRates ? (
            <Button type="button" className="h-10 rounded-xl" onClick={onOpenRates}>
              Open shipping rates
            </Button>
          ) : (
            <Button asChild className="h-10 rounded-xl">
              <Link href={ratesHref}>Open shipping rates</Link>
            </Button>
          )}
          <Button asChild variant="outline" className="h-10 rounded-xl">
            <Link
              href="https://www.shipengine.com/docs/carriers/ups/"
              target="_blank"
              rel="noreferrer"
            >
              UPS setup docs
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
