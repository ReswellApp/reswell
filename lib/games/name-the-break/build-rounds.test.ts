import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { NAME_THE_BREAK_CHALLENGES } from "./breaks.ts"
import { buildNameTheBreakRounds, pickWrongNames, shuffleInPlace } from "./build-rounds.ts"

describe("name-the-break build-rounds", () => {
  it("shuffles without dropping items", () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffleInPlace([...input], () => 0.2)
    assert.equal(out.length, 5)
    assert.deepEqual([...out].sort(), input)
  })

  it("never includes the correct name in wrong answers", () => {
    const correct = NAME_THE_BREAK_CHALLENGES[0]!
    const wrong = pickWrongNames(correct, NAME_THE_BREAK_CHALLENGES, 3, () => 0.1)
    assert.equal(wrong.length, 3)
    assert.ok(!wrong.includes(correct.name))
  })

  it("builds rounds with four unique choices including the answer", () => {
    let seq = 0
    const random = () => {
      seq += 1
      return (seq % 10) / 10
    }
    const rounds = buildNameTheBreakRounds(NAME_THE_BREAK_CHALLENGES, 8, random)
    assert.equal(rounds.length, 8)
    for (const round of rounds) {
      assert.equal(round.choices.length, 4)
      assert.equal(new Set(round.choices).size, 4)
      assert.ok(round.choices.includes(round.challenge.name))
    }
  })
})
