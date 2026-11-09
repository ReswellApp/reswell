import type { SurfboardSellCategoryKey } from "@/lib/surfboard-sell-categories"

/** One Board Match prompt: pick the best board type for a session. */
export interface BoardMatchScenario {
  id: string
  /** Short headline shown above the session detail. */
  headline: string
  /** Conditions / wave description. */
  session: string
  /** Rider context (level, size goals, etc.). */
  rider: string
  /** Four board-type choices shown to the player. */
  choices: readonly SurfboardSellCategoryKey[]
  correct: SurfboardSellCategoryKey
  /** Plain-language explanation after answering. */
  why: string
}

export type BoardMatchPhase = "intro" | "playing" | "revealed" | "results"

export interface BoardMatchAnswerResult {
  correct: boolean
  pointsEarned: number
  basePoints: number
  speedBonus: number
  streakBonus: number
  streak: number
}

export interface BoardMatchRoundSummary {
  totalPoints: number
  correctCount: number
  questionCount: number
  bestStreak: number
  /** Most-picked correct board type this round — used for shop CTA. */
  featuredBoardType: SurfboardSellCategoryKey | null
}

export interface BoardMatchCareerStats {
  totalPoints: number
  bestRound: number
  gamesPlayed: number
}
