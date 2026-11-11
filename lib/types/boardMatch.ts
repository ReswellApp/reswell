/** Catalog brand option shown as a multiple-choice answer. */
export type BoardMatchBrandOption = {
  id: string
  name: string
  slug: string
}

/** Catalog model option shown for the model-name bonus. */
export type BoardMatchModelOption = {
  id: string
  name: string
}

/**
 * One Board Match card: a marketplace board photo tied to a catalog brand + model.
 * Players match the brand for points, then the model name for a bonus.
 */
export type BoardMatchCard = {
  id: string
  listingId: string
  listingSlug: string | null
  imageUrl: string
  brand: BoardMatchBrandOption
  model: BoardMatchModelOption
  /** Four brand choices including the correct brand. */
  brandChoices: BoardMatchBrandOption[]
  /** Four model choices from the same brand, including the correct model. */
  modelChoices: BoardMatchModelOption[]
}

export type BoardMatchPhase = "intro" | "playing" | "revealed" | "results"

/** Sub-step while a card is in play. */
export type BoardMatchPlayStep = "brand" | "model"

export type BoardMatchAnswerResult = {
  brandCorrect: boolean
  modelCorrect: boolean
  pointsEarned: number
  brandPoints: number
  modelBonus: number
  speedBonus: number
  streakBonus: number
  /** Brand-correct streak after this card (0 when brand wrong). */
  streak: number
}

export type BoardMatchRoundSummary = {
  totalPoints: number
  brandCorrectCount: number
  modelCorrectCount: number
  questionCount: number
  bestStreak: number
  /** Most frequently correct brand this round — used for shop CTA. */
  featuredBrand: BoardMatchBrandOption | null
}

export type BoardMatchCareerStats = {
  totalPoints: number
  bestRound: number
  gamesPlayed: number
}
