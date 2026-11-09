import type {
  BoardMatchAnswerResult,
  BoardMatchBrandOption,
  BoardMatchCard,
  BoardMatchRoundSummary,
} from "@/lib/types/boardMatch"

export const BOARD_MATCH_BRAND_POINTS = 100
export const BOARD_MATCH_MODEL_BONUS = 75
export const BOARD_MATCH_SPEED_BONUS_MAX = 40
/** Full speed bonus if brand answered within this many ms. */
export const BOARD_MATCH_SPEED_FULL_MS = 5_000
/** Speed bonus reaches 0 at this elapsed time. */
export const BOARD_MATCH_SPEED_ZERO_MS = 12_000
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

/**
 * Score one card. Brand match earns base + speed + streak.
 * Model-name match adds a bonus only when the brand was correct.
 */
export function scoreBoardMatchAnswer(input: {
  card: BoardMatchCard
  brandChoiceId: string | null
  modelChoiceId: string | null
  /** Elapsed ms for the brand pick. */
  brandElapsedMs: number
  priorStreak: number
}): BoardMatchAnswerResult {
  const brandCorrect = input.brandChoiceId === input.card.brand.id
  if (!brandCorrect) {
    return {
      brandCorrect: false,
      modelCorrect: false,
      pointsEarned: 0,
      brandPoints: 0,
      modelBonus: 0,
      speedBonus: 0,
      streakBonus: 0,
      streak: 0,
    }
  }

  const streak = input.priorStreak + 1
  const brandPoints = BOARD_MATCH_BRAND_POINTS
  const speedBonus = boardMatchSpeedBonus(input.brandElapsedMs)
  const streakBonus = boardMatchStreakBonus(streak)
  const modelCorrect = input.modelChoiceId === input.card.model.id
  const modelBonus = modelCorrect ? BOARD_MATCH_MODEL_BONUS : 0

  return {
    brandCorrect: true,
    modelCorrect,
    pointsEarned: brandPoints + speedBonus + streakBonus + modelBonus,
    brandPoints,
    modelBonus,
    speedBonus,
    streakBonus,
    streak,
  }
}

export function summarizeBoardMatchRound(input: {
  cards: readonly BoardMatchCard[]
  brandChoiceIds: readonly (string | null)[]
  modelChoiceIds: readonly (string | null)[]
  pointsPerQuestion: readonly number[]
  streaksAfterEach: readonly number[]
}): BoardMatchRoundSummary {
  const questionCount = input.cards.length
  let brandCorrectCount = 0
  let modelCorrectCount = 0
  let totalPoints = 0
  let bestStreak = 0
  const brandHits = new Map<string, { count: number; brand: BoardMatchBrandOption }>()

  for (let i = 0; i < questionCount; i++) {
    const card = input.cards[i]
    const brandChoiceId = input.brandChoiceIds[i]
    const modelChoiceId = input.modelChoiceIds[i]
    const points = input.pointsPerQuestion[i] ?? 0
    const streak = input.streaksAfterEach[i] ?? 0
    totalPoints += points
    if (streak > bestStreak) bestStreak = streak
    if (!card || brandChoiceId == null) continue
    if (brandChoiceId !== card.brand.id) continue
    brandCorrectCount += 1
    const prev = brandHits.get(card.brand.id)
    brandHits.set(card.brand.id, {
      count: (prev?.count ?? 0) + 1,
      brand: card.brand,
    })
    if (modelChoiceId === card.model.id) modelCorrectCount += 1
  }

  let featuredBrand: BoardMatchBrandOption | null = null
  let featuredCount = 0
  for (const hit of brandHits.values()) {
    if (hit.count > featuredCount) {
      featuredBrand = hit.brand
      featuredCount = hit.count
    }
  }

  return {
    totalPoints,
    brandCorrectCount,
    modelCorrectCount,
    questionCount,
    bestStreak,
    featuredBrand,
  }
}
