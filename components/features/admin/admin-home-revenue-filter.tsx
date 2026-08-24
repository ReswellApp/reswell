'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarRange } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ADMIN_INSIGHTS_MONTH_PICKER_COUNT,
  ADMIN_INSIGHTS_PERIOD_DAYS,
  utcYearMonthChoices,
  type AdminHomeRevenueRange,
} from '@/lib/utils/adminInsightsPeriod'
import { formatMonthKey } from '@/lib/pnl-calc'

const ROLLING_30 = '30d'
const ROLLING_90 = '90d'
const RANGE_YTD = 'ytd'

const MONTH_CHOICES = utcYearMonthChoices(ADMIN_INSIGHTS_MONTH_PICKER_COUNT)

export interface AdminHomeRevenueFilterProps {
  selectedYearMonth: string | null
  range: AdminHomeRevenueRange
}

function currentValue(selectedYearMonth: string | null, range: AdminHomeRevenueRange): string {
  if (selectedYearMonth) return selectedYearMonth
  return range
}

export function AdminHomeRevenueFilter({
  selectedYearMonth,
  range,
}: AdminHomeRevenueFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const value = currentValue(selectedYearMonth, range)

  function onPeriodChange(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (next === RANGE_YTD) {
      params.delete('month')
      params.delete('range')
    } else if (next === ROLLING_30 || next === ROLLING_90) {
      params.delete('month')
      params.set('range', next)
    } else {
      params.set('month', next)
      params.delete('range')
    }
    const qs = params.toString()
    router.push(qs ? `/admin/home?${qs}` : '/admin/home')
  }

  return (
    <Select value={value} onValueChange={onPeriodChange}>
      <SelectTrigger
        className="h-8 w-full min-w-[168px] sm:w-[200px]"
        aria-label="Revenue period"
      >
        <CalendarRange className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={ROLLING_30}>Last {ADMIN_INSIGHTS_PERIOD_DAYS} days</SelectItem>
        <SelectItem value={ROLLING_90}>Past 3 months</SelectItem>
        <SelectItem value={RANGE_YTD}>Year to date</SelectItem>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Months</SelectLabel>
          {MONTH_CHOICES.map((ym) => (
            <SelectItem key={ym} value={ym}>
              {formatMonthKey(ym)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
