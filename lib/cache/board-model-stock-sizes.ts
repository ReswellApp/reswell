import { unstable_cache } from "next/cache"
import { listSurfboardStockSizesForSellService } from "@/lib/services/brandModelVariants"
import type { SurfboardStockSizeOption } from "@/lib/types/board-stock-sizes"
import { getDb } from "@/lib/supabase/db"

/** `/sell` boards stock-size picker — keyed by brand model id. */
export const BOARD_MODEL_STOCK_SIZES_CACHE_TAG = "board-model-stock-sizes"
const BOARD_MODEL_STOCK_SIZES_REVALIDATE_SECONDS = 60 * 10

async function loadBoardModelStockSizes(
  brandModelId: string,
): Promise<SurfboardStockSizeOption[]> {
  const supabase = getDb({ consistency: "eventual" })
  return listSurfboardStockSizesForSellService(supabase, brandModelId)
}

export const getBoardModelStockSizesCached = unstable_cache(
  loadBoardModelStockSizes,
  ["board-model-stock-sizes-v2"],
  {
    revalidate: BOARD_MODEL_STOCK_SIZES_REVALIDATE_SECONDS,
    tags: [BOARD_MODEL_STOCK_SIZES_CACHE_TAG],
  },
)
