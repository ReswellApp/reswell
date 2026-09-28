import type { AdVerdict, AdsMetrics, DeliveryStatus } from "@/lib/types/adsManager"

export interface ScoreBenchmarks {
  cpa: number | null
  roas: number | null
  /** Spend with zero conversions is a loser once it clears this amount. */
  spendFloor: number
}

const LEARNING_IMPRESSIONS = 500

export function benchmarksFromMetrics(metrics: AdsMetrics, spendFloor = 25): ScoreBenchmarks {
  return {
    cpa: metrics.cpa,
    roas: metrics.roas,
    spendFloor,
  }
}

export function scoreDelivery(input: {
  status: DeliveryStatus
  metrics: AdsMetrics
  benchmarks: ScoreBenchmarks
}): AdVerdict {
  if (input.status === "removed" || input.status === "other") return "paused"

  const { metrics, benchmarks } = input
  const enoughDelivery = metrics.impressions >= LEARNING_IMPRESSIONS || metrics.spend >= benchmarks.spendFloor
  if (!enoughDelivery) return input.status === "paused" ? "paused" : "learning"
  if (metrics.conversions <= 0) return "loser"

  if (benchmarks.roas != null && benchmarks.roas > 0 && metrics.roas != null) {
    if (metrics.roas >= benchmarks.roas * 1.25) return "winner"
    if (metrics.roas <= benchmarks.roas * 0.6) return "loser"
    return "ok"
  }

  if (benchmarks.cpa != null && benchmarks.cpa > 0 && metrics.cpa != null) {
    if (metrics.cpa <= benchmarks.cpa * 0.8) return "winner"
    if (metrics.cpa >= benchmarks.cpa * 1.4) return "loser"
    return "ok"
  }

  return "ok"
}
