import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { BOARD_MATCH_DECK } from "./deck.ts"
import {
  BOARD_MATCH_BASE_POINTS,
  BOARD_MATCH_SPEED_BONUS_MAX,
  BOARD_MATCH_STREAK_3_BONUS,
  BOARD_MATCH_STREAK_5_BONUS,
  boardMatchSpeedBonus,
  boardMatchStreakBonus,
  scoreBoardMatchAnswer,
  summarizeBoardMatchRound,
} from "./scoring.ts"
import { boardMatchShopHref, buildBoardMatchRound } from "./session.ts"

describe("board match scoring", () => {
  it("awards full speed bonus under the fast threshold", () => {
    assert.equal(boardMatchSpeedBonus(0), BOARD_MATCH_SPEED_BONUS_MAX)
    assert.equal(boardMatchSpeedBonus(3_500), BOARD_MATCH_SPEED_BONUS_MAX)
  })

  it("decays speed bonus to zero after the slow threshold", () => {
    assert.equal(boardMatchSpeedBonus(10_000), 0)
    assert.equal(boardMatchSpeedBonus(12_000), 0)
    assert.ok(boardMatchSpeedBonus(7_000) > 0)
    assert.ok(boardMatchSpeedBonus(7_000) < BOARD_MATCH_SPEED_BONUS_MAX)
  })

  it("pays streak bonuses at 3 and 5", () => {
    assert.equal(boardMatchStreakBonus(2), 0)
    assert.equal(boardMatchStreakBonus(3), BOARD_MATCH_STREAK_3_BONUS)
    assert.equal(boardMatchStreakBonus(4), BOARD_MATCH_STREAK_3_BONUS)
    assert.equal(boardMatchStreakBonus(5), BOARD_MATCH_STREAK_5_BONUS)
  })

  it("scores a correct answer with base + speed + streak", () => {
    const scenario = BOARD_MATCH_DECK[0]!
    const result = scoreBoardMatchAnswer({
      scenario,
      choice: scenario.correct,
      elapsedMs: 1_000,
      priorStreak: 2,
    })
    assert.equal(result.correct, true)
    assert.equal(result.streak, 3)
    assert.equal(result.basePoints, BOARD_MATCH_BASE_POINTS)
    assert.equal(result.speedBonus, BOARD_MATCH_SPEED_BONUS_MAX)
    assert.equal(result.streakBonus, BOARD_MATCH_STREAK_3_BONUS)
    assert.equal(
      result.pointsEarned,
      BOARD_MATCH_BASE_POINTS + BOARD_MATCH_SPEED_BONUS_MAX + BOARD_MATCH_STREAK_3_BONUS,
    )
  })

  it("returns zero points on a wrong answer and resets streak", () => {
    const scenario = BOARD_MATCH_DECK[0]!
    const wrong = scenario.choices.find((c) => c !== scenario.correct)!
    const result = scoreBoardMatchAnswer({
      scenario,
      choice: wrong,
      elapsedMs: 500,
      priorStreak: 4,
    })
    assert.equal(result.correct, false)
    assert.equal(result.pointsEarned, 0)
    assert.equal(result.streak, 0)
  })
})

describe("board match session", () => {
  it("builds a deterministic shuffled round", () => {
    let i = 0
    const sequence = [0.1, 0.9, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6, 0.15, 0.55, 0.25, 0.45]
    const random = () => sequence[i++ % sequence.length]!
    const round = buildBoardMatchRound(4, random)
    assert.equal(round.length, 4)
    const ids = new Set(round.map((s) => s.id))
    assert.equal(ids.size, 4)
    for (const scenario of round) {
      assert.equal(scenario.choices.length, 4)
      assert.ok(scenario.choices.includes(scenario.correct))
    }
  })

  it("summarizes a round and picks a featured board type", () => {
    const scenarios = BOARD_MATCH_DECK.slice(0, 3)
    const summary = summarizeBoardMatchRound({
      scenarios,
      choices: [scenarios[0]!.correct, scenarios[1]!.correct, null],
      pointsPerQuestion: [140, 100, 0],
      streaksAfterEach: [1, 2, 0],
    })
    assert.equal(summary.correctCount, 2)
    assert.equal(summary.questionCount, 3)
    assert.equal(summary.totalPoints, 240)
    assert.equal(summary.bestStreak, 2)
    assert.ok(summary.featuredBoardType)
  })

  it("maps board types to shop browse URLs", () => {
    assert.equal(boardMatchShopHref("shortboard"), "/boards?type=shortboard")
    assert.equal(boardMatchShopHref("step-up-gun"), "/boards?type=step-up-gun")
    assert.equal(boardMatchShopHref(null), "/boards")
    assert.equal(boardMatchShopHref("other"), "/boards")
  })
})
