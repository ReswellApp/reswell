import { ADS_RANGE_DAYS, type AdsRangeDays } from "@/lib/types/adsManager"

export function isAdsRangeDays(value: number): value is AdsRangeDays {
  return (ADS_RANGE_DAYS as readonly number[]).includes(value)
}

export function rangeDates(days: AdsRangeDays, now = new Date()): { since: string; until: string } {
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const since = new Date(until)
  since.setUTCDate(since.getUTCDate() - (days - 1))
  return { since: isoDate(since), until: isoDate(until) }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
