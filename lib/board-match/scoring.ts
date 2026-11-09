import type {
  BoardMatchAnswerResult,
  BoardMatchRoundSummary,
  BoardMatchScenario,
} from "@/lib/types/boardMatch"
import type { SurfboardSellCategoryKey } from "@/lib/surfboard-sell-categories"

export const BOARD_MATCH_BASE_POINTS = 100
export const BOARD_MATCH_SPEED_BONUS_MAX = 40
/** Full speed bonus if answered within this many ms. */
export const BOARD_MATCH_SPEED_FULL_MS = 4_000
/** Speed bonus reaches 0 at this elapsed time. */
export const BOARD_MATCH_SPEED_ZERO_MS = 10_000
export const BOARD_MATCH_STREAK_3_BONUS = 25
export const BOARD_MATCH_STREAK_5_BONUS = 50

export function boardMatchSpeedBonus(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 0
  if (elapsedMs <= BOARD_MATCH_SPEED_FULL_MS) return BOARD_MATCH_SPEED_BONUS_MAX
  if (elapsedMs >= BOARD_MATCH_SPEED_ZERO_MS) return 0
  const span = BOARD_MATCH_SPEED_ZERO_MS - BOARD_MATCH_SPEED_FULL_MS
  const remaining = BOARD_MATCH_SPEED_ZERO_MS - elapsedMs
  return Math.round((remaining / span) * BOARD_MATCH_SPEED_BONUS_MAX)
}

export function boardMatchStreakBonus(streakAfterCorrect: number): number {
  if (streakAfterCorrect >= 5) return BOARD_MATCH_STREAK_5_BONUS
  if (streakAfterCorrect >= 3) return BOARD_MATCH_STREAK_3_BONUS
  return 0
}

export function scoreBoardMatchAnswer(input: {
  scenario: BoardMatchScenario
  choice: SurfboardSellCategoryKey
  elapsedMs: number
  /** Streak before this answer (correct answers in a row). */
  priorStreak: number
}): BoardMatchAnswerResult {
  const correct = input.choice === input.scenario.correct
  if (!correct) {
    return {
      correct: false,
      pointsEarned: 0,
      basePoints: 0,
      speedBonus: 0,
      streakBonus: 0,
      streak: 0,
    }
  }

  const streak = input.priorStreak + 1
  const basePoints = BOARD_MATCH_BASE_POINTS
  const speedBonus = boardMatchSpeedBonus(input.elapsedMs)
  const streakBonus = boardMatchStreakBonus(streak)

  return {
    correct: true,
    pointsEarned: basePoints + speedBonus + streakBonus,
    basePoints,
    speedBonus,
    streakBonus,
    streak,
  }
}

export function summarizeBoardMatchRound(input: {
  scenarios: readonly BoardMatchScenario[]
  choices: readonly (SurfboardSellCategoryKey | null)[]
  pointsPerQuestion: readonly number[]
  streaksAfterEach: readonly number[]
}): BoardMatchRoundSummary {
  const questionCount = input.scenarios.length
  let correctCount = 0
  let totalPoints = 0
  let bestStreak = 0
  const correctTypeCounts = new Map<SurfboardSellCategoryKey, number>()

  for (let i = 0; i < questionCount; i++) {
    const scenario = input.scenarios[i]
    const choice = input.choices[i]
    const points = input.pointsPerQuestion[i] ?? 0
    const streak = input.streaksAfterEach[i] ?? 0
    totalPoints += points
    if (streak > bestStreak) bestStreak = streak
    if (!scenario || choice == null) continue
    if (choice === scenario.correct) {
      correctCount += 1
      correctTypeCounts.set(scenario.correct, (correctTypeCounts.get(scenario.correct) ?? 0) + 1)
    }
  }

  let featuredBoardType: SurfboardSellCategoryKey | null = null
  let featuredCount = 0
  for (const [type, count] of correctTypeCounts) {
    if (count > featuredCount) {
      featuredBoardType = type
      featuredCount = count
    }
  }

  return {
    totalPoints,
    correctCount,
    questionCount,
    bestStreak,
    featuredBoardType,
  }
}
