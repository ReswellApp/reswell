import type { MobileMarketplaceSalesMap } from "@reswell/api-contract"
import { UsaSalesFlowMapFallback } from "@/components/sales-map/usa-sales-flow-map-fallback"
import { isNativeSvgAvailable } from "@/lib/native-svg-available"
import type { ReswellColors } from "@/theme"

type UsaSalesFlowMapProps = {
  data: MobileMarketplaceSalesMap
  colors: ReswellColors
}

export function UsaSalesFlowMap({ data, colors }: UsaSalesFlowMapProps) {
  if (!isNativeSvgAvailable()) {
    return <UsaSalesFlowMapFallback data={data} colors={colors} />
  }
  const { UsaSalesFlowMapNative } =
    require("@/components/sales-map/usa-sales-flow-map-native") as typeof import("@/components/sales-map/usa-sales-flow-map-native")
  return <UsaSalesFlowMapNative data={data} colors={colors} />
}
