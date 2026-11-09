import {
  NAME_THE_BREAK_CHALLENGES,
  NAME_THE_BREAK_ROUND_COUNT,
} from "@/lib/games/name-the-break/breaks"
import type {
  NameTheBreakRound,
  SurfBreakChallenge,
} from "@/lib/games/name-the-break/types"

/** Fisher–Yates shuffle — mutates a copy, never the source array. */
export function shuffleInPlace<T>(items: T[], random = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const tmp = items[i]!
    items[i] = items[j]!
    items[j] = tmp
  }
  return items
}

export function pickWrongNames(
  correct: SurfBreakChallenge,
  pool: SurfBreakChallenge[],
  count: number,
  random = Math.random,
): string[] {
  const others = pool.filter((b) => b.id !== correct.id).map((b) => b.name)
  shuffleInPlace(others, random)
  return others.slice(0, count)
}

/**
 * Build a fresh run: `roundCount` challenges with four shuffled multiple-choice answers each.
 */
export function buildNameTheBreakRounds(
  pool: SurfBreakChallenge[] = NAME_THE_BREAK_CHALLENGES,
  roundCount = NAME_THE_BREAK_ROUND_COUNT,
  random = Math.random,
): NameTheBreakRound[] {
  const selected = shuffleInPlace([...pool], random).slice(
    0,
    Math.min(roundCount, pool.length),
  )

  return selected.map((challenge) => {
    const wrong = pickWrongNames(challenge, pool, 3, random)
    const choices = shuffleInPlace([challenge.name, ...wrong], random)
    return { challenge, choices }
  })
}
