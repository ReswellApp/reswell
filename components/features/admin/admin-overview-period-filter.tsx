'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarRange } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ADMIN_INSIGHTS_MONTH_PICKER_COUNT,
  ADMIN_INSIGHTS_PERIOD_DAYS,
  utcYearMonthChoices,
} from '@/lib/utils/adminInsightsPeriod'
import { formatMonthKey } from '@/lib/pnl-calc'

const ROLLING_VALUE = 'rolling'

const MONTH_CHOICES = utcYearMonthChoices(ADMIN_INSIGHTS_MONTH_PICKER_COUNT)

export interface AdminOverviewPeriodFilterProps {
  selectedYearMonth: string | null
}

export function AdminOverviewPeriodFilter({
  selectedYearMonth,
}: AdminOverviewPeriodFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const value = selectedYearMonth ?? ROLLING_VALUE

  function onPeriodChange(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (next === ROLLING_VALUE) {
      params.delete('month')
    } else {
      params.set('month', next)
    }
    const qs = params.toString()
    router.push(qs ? `/admin/overview?${qs}` : '/admin/overview')
  }

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Report period
      </span>
      <Select value={value} onValueChange={onPeriodChange}>
        <SelectTrigger className="w-full min-w-[220px] sm:w-[240px]" aria-label="Report period">
          <CalendarRange className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value={ROLLING_VALUE}>
            Last {ADMIN_INSIGHTS_PERIOD_DAYS} days (rolling)
          </SelectItem>
          {MONTH_CHOICES.map((ym) => (
            <SelectItem key={ym} value={ym}>
              {formatMonthKey(ym)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
