import type { IntelligenceTrend } from "@/lib/types/businessIntelligence"

export function intelligenceTrend(current: number, previous: number): IntelligenceTrend {
  const deltaPct = previous > 0 ? ((current - previous) / previous) * 100 : null
  return { current, previous, deltaPct }
}
