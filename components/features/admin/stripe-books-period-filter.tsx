"use client"

import { useRouter } from "next/navigation"
import { CalendarRange } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ADMIN_INSIGHTS_MONTH_PICKER_COUNT, businessYearMonthChoices } from "@/lib/utils/adminInsightsPeriod"
import { formatMonthKey } from "@/lib/utils/adminRevenueMonthly"
import type { StripeBooksPeriod } from "@/lib/types/stripeBooks"
import { stripeBooksHref } from "@/lib/utils/stripeBooks"

const MONTH_CHOICES = businessYearMonthChoices(ADMIN_INSIGHTS_MONTH_PICKER_COUNT)

function currentValue(period: StripeBooksPeriod): string {
  if (period.yearMonth) return period.yearMonth
  return period.mode
}

export function StripeBooksPeriodFilter({ period }: { period: StripeBooksPeriod }) {
  const router = useRouter()

  function onPeriodChange(next: string) {
    if (next === "all") {
      router.push(stripeBooksHref({}))
      return
    }
    if (next === "ytd" || next === "30d" || next === "90d") {
      router.push(stripeBooksHref({ range: next }))
      return
    }
    router.push(stripeBooksHref({ month: next }))
  }

  return (
    <Select value={currentValue(period)} onValueChange={onPeriodChange}>
      <SelectTrigger className="h-8 w-full min-w-0 sm:min-w-[168px] sm:w-[200px]" aria-label="Books period">
        <CalendarRange className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="all">All time</SelectItem>
        <SelectItem value="30d">Last 30 days</SelectItem>
        <SelectItem value="90d">Past 3 months</SelectItem>
        <SelectItem value="ytd">Year to date</SelectItem>
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
