import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  BOARD_MATCH_BRAND_POINTS,
  BOARD_MATCH_MODEL_BONUS,
  BOARD_MATCH_SPEED_BONUS_MAX,
  BOARD_MATCH_STREAK_3_BONUS,
  boardMatchSpeedBonus,
  boardMatchStreakBonus,
  scoreBoardMatchAnswer,
  summarizeBoardMatchRound,
} from "./scoring.ts"
import { boardMatchBrandHref } from "../services/boardMatch.ts"
import type { BoardMatchCard } from "../types/boardMatch.ts"

const sampleCard: BoardMatchCard = {
  id: "listing:model",
  listingId: "listing",
  listingSlug: "lost-rnf",
  imageUrl: "/media/listings/example.jpg",
  brand: { id: "lost", name: "Lost", slug: "lost-surfboards" },
  model: { id: "rnf", name: "RNF" },
  brandChoices: [
    { id: "lost", name: "Lost", slug: "lost-surfboards" },
    { id: "ci", name: "Channel Islands", slug: "channel-islands" },
    { id: "js", name: "JS", slug: "js-industries" },
    { id: "pyzel", name: "Pyzel", slug: "pyzel" },
  ],
  modelChoices: [
    { id: "rnf", name: "RNF" },
    { id: "driver", name: "Driver" },
    { id: "sub", name: "Sub Driver" },
    { id: "round", name: "Round Nose Fish" },
  ],
}

describe("board match scoring", () => {
  it("awards brand points with speed and streak, plus model bonus", () => {
    const result = scoreBoardMatchAnswer({
      card: sampleCard,
      brandChoiceId: "lost",
      modelChoiceId: "rnf",
      brandElapsedMs: 1_000,
      priorStreak: 2,
    })
    assert.equal(result.brandCorrect, true)
    assert.equal(result.modelCorrect, true)
    assert.equal(result.brandPoints, BOARD_MATCH_BRAND_POINTS)
    assert.equal(result.modelBonus, BOARD_MATCH_MODEL_BONUS)
    assert.equal(result.speedBonus, BOARD_MATCH_SPEED_BONUS_MAX)
    assert.equal(result.streakBonus, BOARD_MATCH_STREAK_3_BONUS)
    assert.equal(
      result.pointsEarned,
      BOARD_MATCH_BRAND_POINTS +
        BOARD_MATCH_MODEL_BONUS +
        BOARD_MATCH_SPEED_BONUS_MAX +
        BOARD_MATCH_STREAK_3_BONUS,
    )
  })

  it("pays brand points without model bonus when the model is wrong", () => {
    const result = scoreBoardMatchAnswer({
      card: sampleCard,
      brandChoiceId: "lost",
      modelChoiceId: "driver",
      brandElapsedMs: 20_000,
      priorStreak: 0,
    })
    assert.equal(result.brandCorrect, true)
    assert.equal(result.modelCorrect, false)
    assert.equal(result.modelBonus, 0)
    assert.equal(result.pointsEarned, BOARD_MATCH_BRAND_POINTS)
    assert.equal(result.streak, 1)
  })

  it("returns zero when the brand is wrong", () => {
    const result = scoreBoardMatchAnswer({
      card: sampleCard,
      brandChoiceId: "ci",
      modelChoiceId: "rnf",
      brandElapsedMs: 500,
      priorStreak: 4,
    })
    assert.equal(result.brandCorrect, false)
    assert.equal(result.modelCorrect, false)
    assert.equal(result.pointsEarned, 0)
    assert.equal(result.streak, 0)
  })

  it("decays speed bonus", () => {
    assert.equal(boardMatchSpeedBonus(0), BOARD_MATCH_SPEED_BONUS_MAX)
    assert.equal(boardMatchSpeedBonus(12_000), 0)
    assert.ok(boardMatchSpeedBonus(8_000) > 0)
  })

  it("pays streak bonuses at 3 and 5", () => {
    assert.equal(boardMatchStreakBonus(2), 0)
    assert.equal(boardMatchStreakBonus(3), BOARD_MATCH_STREAK_3_BONUS)
  })
})

describe("board match summary", () => {
  it("summarizes brand/model hits and featured brand", () => {
    const summary = summarizeBoardMatchRound({
      cards: [sampleCard, sampleCard],
      brandChoiceIds: ["lost", "ci"],
      modelChoiceIds: ["rnf", null],
      pointsPerQuestion: [215, 0],
      streaksAfterEach: [1, 0],
    })
    assert.equal(summary.brandCorrectCount, 1)
    assert.equal(summary.modelCorrectCount, 1)
    assert.equal(summary.totalPoints, 215)
    assert.equal(summary.featuredBrand?.slug, "lost-surfboards")
  })

  it("maps featured brands to brand profile URLs", () => {
    assert.equal(boardMatchBrandHref(sampleCard.brand), "/brands/lost-surfboards")
    assert.equal(boardMatchBrandHref(null), "/brands")
  })
})
