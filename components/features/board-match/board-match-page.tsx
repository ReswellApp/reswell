"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

import { BoardMatchIntro } from "@/components/features/board-match/board-match-intro"
import { BoardMatchPlay } from "@/components/features/board-match/board-match-play"
import { BoardMatchResults } from "@/components/features/board-match/board-match-results"
import {
  readBoardMatchCareerStats,
  recordBoardMatchRound,
} from "@/lib/board-match/points-storage"
import { scoreBoardMatchAnswer, summarizeBoardMatchRound } from "@/lib/board-match/scoring"
import { boardMatchShopHref, buildBoardMatchRound } from "@/lib/board-match/session"
import type {
  BoardMatchAnswerResult,
  BoardMatchCareerStats,
  BoardMatchPhase,
  BoardMatchRoundSummary,
  BoardMatchScenario,
} from "@/lib/types/boardMatch"
import type { SurfboardSellCategoryKey } from "@/lib/surfboard-sell-categories"
import { SURFBOARD_SELL_CATEGORY_LABELS } from "@/lib/surfboard-sell-categories"

export function BoardMatchPage() {
  const [phase, setPhase] = useState<BoardMatchPhase>("intro")
  const [scenarios, setScenarios] = useState<BoardMatchScenario[]>([])
  const [index, setIndex] = useState(0)
  const [streak, setStreak] = useState(0)
  const [roundPoints, setRoundPoints] = useState(0)
  const [choices, setChoices] = useState<(SurfboardSellCategoryKey | null)[]>([])
  const [pointsPerQuestion, setPointsPerQuestion] = useState<number[]>([])
  const [streaksAfterEach, setStreaksAfterEach] = useState<number[]>([])
  const [lastResult, setLastResult] = useState<BoardMatchAnswerResult | null>(null)
  const [selected, setSelected] = useState<SurfboardSellCategoryKey | null>(null)
  const [summary, setSummary] = useState<BoardMatchRoundSummary | null>(null)
  const [career, setCareer] = useState<BoardMatchCareerStats>({
    totalPoints: 0,
    bestRound: 0,
    gamesPlayed: 0,
  })
  const questionStartedAt = useRef<number>(0)

  useEffect(() => {
    setCareer(readBoardMatchCareerStats())
  }, [])

  function startRound() {
    const round = buildBoardMatchRound()
    setScenarios(round)
    setIndex(0)
    setStreak(0)
    setRoundPoints(0)
    setChoices(Array.from({ length: round.length }, () => null))
    setPointsPerQuestion(Array.from({ length: round.length }, () => 0))
    setStreaksAfterEach(Array.from({ length: round.length }, () => 0))
    setLastResult(null)
    setSelected(null)
    setSummary(null)
    setPhase("playing")
    questionStartedAt.current = Date.now()
  }

  function onPick(choice: SurfboardSellCategoryKey) {
    if (phase !== "playing") return
    const scenario = scenarios[index]
    if (!scenario) return

    const elapsedMs = Date.now() - questionStartedAt.current
    const result = scoreBoardMatchAnswer({
      scenario,
      choice,
      elapsedMs,
      priorStreak: streak,
    })

    const nextChoices = [...choices]
    nextChoices[index] = choice
    const nextPoints = [...pointsPerQuestion]
    nextPoints[index] = result.pointsEarned
    const nextStreaks = [...streaksAfterEach]
    nextStreaks[index] = result.streak

    setChoices(nextChoices)
    setPointsPerQuestion(nextPoints)
    setStreaksAfterEach(nextStreaks)
    setSelected(choice)
    setLastResult(result)
    setStreak(result.streak)
    setRoundPoints((prev) => prev + result.pointsEarned)
    setPhase("revealed")
  }

  function onContinue() {
    const nextIndex = index + 1
    if (nextIndex >= scenarios.length) {
      const roundSummary = summarizeBoardMatchRound({
        scenarios,
        choices,
        pointsPerQuestion,
        streaksAfterEach,
      })
      // Prefer the live round total in case of any array/state drift.
      const finalized = { ...roundSummary, totalPoints: roundPoints }
      setSummary(finalized)
      setCareer(recordBoardMatchRound(finalized.totalPoints))
      setPhase("results")
      return
    }
    setIndex(nextIndex)
    setSelected(null)
    setLastResult(null)
    setPhase("playing")
    questionStartedAt.current = Date.now()
  }

  const scenario = scenarios[index] ?? null
  const shopHref = boardMatchShopHref(summary?.featuredBoardType ?? null)
  const featuredLabel = summary?.featuredBoardType
    ? SURFBOARD_SELL_CATEGORY_LABELS[summary.featuredBoardType]
    : null

  return (
    <main className="flex-1">
      <div className="relative overflow-hidden border-b border-border/80">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#d7e6ee_0%,_transparent_55%),linear-gradient(180deg,_#f4f8fa_0%,_#ffffff_70%)]"
        />
        <div className="relative container mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
          {phase === "intro" ? (
            <BoardMatchIntro career={career} onStart={startRound} />
          ) : null}

          {(phase === "playing" || phase === "revealed") && scenario ? (
            <BoardMatchPlay
              scenario={scenario}
              index={index}
              total={scenarios.length}
              roundPoints={roundPoints}
              streak={streak}
              phase={phase}
              selected={selected}
              lastResult={lastResult}
              onPick={onPick}
              onContinue={onContinue}
            />
          ) : null}

          {phase === "results" && summary ? (
            <BoardMatchResults
              summary={summary}
              career={career}
              shopHref={shopHref}
              featuredLabel={featuredLabel}
              onPlayAgain={startRound}
            />
          ) : null}
        </div>
      </div>

      <section className="border-b border-border/60 bg-background">
        <div className="container mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <p className="text-sm text-muted-foreground">
            Board Match teaches shape-to-conditions matching. Points stay on this device for
            now — account sync and redeem come next.{" "}
            <Link href="/boards" className="font-medium text-foreground underline-offset-4 hover:underline">
              Browse boards
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
