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
  utcYearMonthChoices,
} from '@/lib/utils/adminInsightsPeriod'
import { formatMonthKey } from '@/lib/pnl-calc'

const ALL_TIME_VALUE = 'all'

const MONTH_CHOICES = utcYearMonthChoices(ADMIN_INSIGHTS_MONTH_PICKER_COUNT)

export interface PnlPeriodFilterProps {
  selectedYearMonth: string | null
}

export function PnlPeriodFilter({ selectedYearMonth }: PnlPeriodFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const value = selectedYearMonth ?? ALL_TIME_VALUE

  function onPeriodChange(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (next === ALL_TIME_VALUE) {
      params.delete('month')
    } else {
      params.set('month', next)
    }
    const qs = params.toString()
    router.push(qs ? `/admin/pnl?${qs}` : '/admin/pnl')
  }

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Report month
      </span>
      <Select value={value} onValueChange={onPeriodChange}>
        <SelectTrigger className="w-full min-w-[220px] sm:w-[240px]" aria-label="P&L report month">
          <CalendarRange className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <SelectValue placeholder="Select month" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value={ALL_TIME_VALUE}>All time</SelectItem>
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
