import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { countUnratedSurfboardDimensionPhotoMatches } from "@/lib/db/surfboardDimensionPhoto"
import {
  isSurfboardDimensionPhotoMatchEnabled,
  rematchSurfboardDimensionPhotoFailures,
  scanSurfboardListingsForDimensionPhotos,
} from "@/lib/services/surfboardDimensionPhotoMatch"

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

export type SurfboardDimensionPhotoCronResult = {
  enabled: boolean
  unratedBefore: number
  unratedCap: number
  rematch: {
    attempted: number
    created: number
    skipped: number
    error: string | null
  }
  scan: {
    scanned: number
    found: number
    skipped: number
    error: string | null
    skippedBecauseCap: boolean
  }
}

/**
 * Pre-fill the admin Unrated queue: rematch Bad/Close, then scan fresh listings
 * up to a small batch so rating work is ready without waiting on the Scan button.
 */
export async function runSurfboardDimensionPhotoQueueCron(
  service: SupabaseClient,
  options: {
    /** New listing_scan rows to create when under the unrated cap. Default 15. */
    scanLimit?: number
    /** Bad/Close rematches per run. Default 8. */
    rematchLimit?: number
    /** Skip new scans when Unrated is already this high. Default 25. */
    unratedCap?: number
  } = {},
): Promise<SurfboardDimensionPhotoCronResult> {
  const scanLimit = Math.min(Math.max(options.scanLimit ?? 15, 1), 40)
  const rematchLimit = Math.min(Math.max(options.rematchLimit ?? 8, 0), 40)
  const unratedCap = Math.min(Math.max(options.unratedCap ?? 25, 1), 100)

  if (!isSurfboardDimensionPhotoMatchEnabled()) {
    return {
      enabled: false,
      unratedBefore: 0,
      unratedCap,
      rematch: { attempted: 0, created: 0, skipped: 0, error: null },
      scan: {
        scanned: 0,
        found: 0,
        skipped: 0,
        error: "Dimension photo matching is not configured.",
        skippedBecauseCap: false,
      },
    }
  }

  const fromIso = new Date(Date.now() - NINETY_DAYS_MS).toISOString()
  const unratedBefore = await countUnratedSurfboardDimensionPhotoMatches(service, fromIso)

  const rematch =
    rematchLimit > 0
      ? await rematchSurfboardDimensionPhotoFailures(service, { limit: rematchLimit })
      : { attempted: 0, created: 0, skipped: 0, error: null }

  const projectedUnrated = unratedBefore + rematch.created
  if (projectedUnrated >= unratedCap) {
    return {
      enabled: true,
      unratedBefore,
      unratedCap,
      rematch,
      scan: {
        scanned: 0,
        found: 0,
        skipped: 0,
        error: null,
        skippedBecauseCap: true,
      },
    }
  }

  const need = Math.min(scanLimit, unratedCap - projectedUnrated)
  const scan = await scanSurfboardListingsForDimensionPhotos(service, { limit: need })

  return {
    enabled: true,
    unratedBefore,
    unratedCap,
    rematch,
    scan: { ...scan, skippedBecauseCap: false },
  }
}
