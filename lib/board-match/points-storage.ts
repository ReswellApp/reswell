import type { BoardMatchCareerStats } from "@/lib/types/boardMatch"

export const BOARD_MATCH_POINTS_STORAGE_KEY = "reswell.board-match.v1.career"

const EMPTY_STATS: BoardMatchCareerStats = {
  totalPoints: 0,
  bestRound: 0,
  gamesPlayed: 0,
}

function isCareerStats(value: unknown): value is BoardMatchCareerStats {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.totalPoints === "number" &&
    Number.isFinite(row.totalPoints) &&
    typeof row.bestRound === "number" &&
    Number.isFinite(row.bestRound) &&
    typeof row.gamesPlayed === "number" &&
    Number.isFinite(row.gamesPlayed)
  )
}

/** Read career points from localStorage. Safe on the server (returns zeros). */
export function readBoardMatchCareerStats(): BoardMatchCareerStats {
  if (typeof window === "undefined") return { ...EMPTY_STATS }
  try {
    const raw = window.localStorage.getItem(BOARD_MATCH_POINTS_STORAGE_KEY)
    if (!raw) return { ...EMPTY_STATS }
    const parsed: unknown = JSON.parse(raw)
    if (!isCareerStats(parsed)) return { ...EMPTY_STATS }
    return {
      totalPoints: Math.max(0, Math.floor(parsed.totalPoints)),
      bestRound: Math.max(0, Math.floor(parsed.bestRound)),
      gamesPlayed: Math.max(0, Math.floor(parsed.gamesPlayed)),
    }
  } catch {
    return { ...EMPTY_STATS }
  }
}

export function writeBoardMatchCareerStats(stats: BoardMatchCareerStats): void {
  if (typeof window === "undefined") return
  const next: BoardMatchCareerStats = {
    totalPoints: Math.max(0, Math.floor(stats.totalPoints)),
    bestRound: Math.max(0, Math.floor(stats.bestRound)),
    gamesPlayed: Math.max(0, Math.floor(stats.gamesPlayed)),
  }
  try {
    window.localStorage.setItem(BOARD_MATCH_POINTS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Quota / private mode — ignore; session still plays.
  }
}

/** Apply a finished round to career totals. Returns the updated career stats. */
export function recordBoardMatchRound(roundPoints: number): BoardMatchCareerStats {
  const prior = readBoardMatchCareerStats()
  const next: BoardMatchCareerStats = {
    totalPoints: prior.totalPoints + Math.max(0, Math.floor(roundPoints)),
    bestRound: Math.max(prior.bestRound, Math.max(0, Math.floor(roundPoints))),
    gamesPlayed: prior.gamesPlayed + 1,
  }
  writeBoardMatchCareerStats(next)
  return next
}
