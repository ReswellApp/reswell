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
import { boardMatchBrandHref } from "@/lib/services/boardMatch"
import type {
  BoardMatchAnswerResult,
  BoardMatchCard,
  BoardMatchCareerStats,
  BoardMatchPhase,
  BoardMatchPlayStep,
  BoardMatchRoundSummary,
} from "@/lib/types/boardMatch"

function shuffleCards(cards: BoardMatchCard[]): BoardMatchCard[] {
  const next = [...cards]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = next[i]!
    next[i] = next[j]!
    next[j] = tmp
  }
  return next
}

export function BoardMatchPage({
  initialCards,
  unavailable,
}: {
  initialCards: BoardMatchCard[]
  unavailable: boolean
}) {
  const [phase, setPhase] = useState<BoardMatchPhase>("intro")
  const [playStep, setPlayStep] = useState<BoardMatchPlayStep>("brand")
  const [cards, setCards] = useState<BoardMatchCard[]>([])
  const [index, setIndex] = useState(0)
  const [streak, setStreak] = useState(0)
  const [roundPoints, setRoundPoints] = useState(0)
  const [brandChoiceIds, setBrandChoiceIds] = useState<(string | null)[]>([])
  const [modelChoiceIds, setModelChoiceIds] = useState<(string | null)[]>([])
  const [pointsPerQuestion, setPointsPerQuestion] = useState<number[]>([])
  const [streaksAfterEach, setStreaksAfterEach] = useState<number[]>([])
  const [lastResult, setLastResult] = useState<BoardMatchAnswerResult | null>(null)
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [summary, setSummary] = useState<BoardMatchRoundSummary | null>(null)
  const [career, setCareer] = useState<BoardMatchCareerStats>({
    totalPoints: 0,
    bestRound: 0,
    gamesPlayed: 0,
  })
  const brandStartedAt = useRef<number>(0)
  const pendingBrandId = useRef<string | null>(null)
  const brandElapsedMsRef = useRef<number>(0)

  useEffect(() => {
    setCareer(readBoardMatchCareerStats())
  }, [])

  const deckReady = !unavailable && initialCards.length > 0

  function startRound() {
    if (!deckReady) return
    const round = shuffleCards(initialCards)
    setCards(round)
    setIndex(0)
    setStreak(0)
    setRoundPoints(0)
    setBrandChoiceIds(Array.from({ length: round.length }, () => null))
    setModelChoiceIds(Array.from({ length: round.length }, () => null))
    setPointsPerQuestion(Array.from({ length: round.length }, () => 0))
    setStreaksAfterEach(Array.from({ length: round.length }, () => 0))
    setLastResult(null)
    setSelectedBrandId(null)
    setSelectedModelId(null)
    setSummary(null)
    setPlayStep("brand")
    setPhase("playing")
    pendingBrandId.current = null
    brandElapsedMsRef.current = 0
    brandStartedAt.current = Date.now()
  }

  function finalizeCard(input: {
    brandChoiceId: string
    modelChoiceId: string | null
    brandElapsedMs: number
  }) {
    const card = cards[index]
    if (!card) return

    const result = scoreBoardMatchAnswer({
      card,
      brandChoiceId: input.brandChoiceId,
      modelChoiceId: input.modelChoiceId,
      brandElapsedMs: input.brandElapsedMs,
      priorStreak: streak,
    })

    const nextBrandIds = [...brandChoiceIds]
    nextBrandIds[index] = input.brandChoiceId
    const nextModelIds = [...modelChoiceIds]
    nextModelIds[index] = input.modelChoiceId
    const nextPoints = [...pointsPerQuestion]
    nextPoints[index] = result.pointsEarned
    const nextStreaks = [...streaksAfterEach]
    nextStreaks[index] = result.streak

    setBrandChoiceIds(nextBrandIds)
    setModelChoiceIds(nextModelIds)
    setPointsPerQuestion(nextPoints)
    setStreaksAfterEach(nextStreaks)
    setSelectedBrandId(input.brandChoiceId)
    setSelectedModelId(input.modelChoiceId)
    setLastResult(result)
    setStreak(result.streak)
    setRoundPoints((prev) => prev + result.pointsEarned)
    setPhase("revealed")
  }

  function onPickBrand(brandId: string) {
    if (phase !== "playing" || playStep !== "brand") return
    const card = cards[index]
    if (!card) return

    const elapsedMs = Date.now() - brandStartedAt.current
    brandElapsedMsRef.current = elapsedMs
    pendingBrandId.current = brandId
    setSelectedBrandId(brandId)

    if (brandId !== card.brand.id) {
      finalizeCard({
        brandChoiceId: brandId,
        modelChoiceId: null,
        brandElapsedMs: elapsedMs,
      })
      return
    }

    // Brand correct — unlock model bonus step.
    setPlayStep("model")
  }

  function onPickModel(modelId: string) {
    if (phase !== "playing" || playStep !== "model") return
    const brandId = pendingBrandId.current ?? selectedBrandId
    if (!brandId) return
    finalizeCard({
      brandChoiceId: brandId,
      modelChoiceId: modelId,
      brandElapsedMs: brandElapsedMsRef.current,
    })
  }

  function onContinue() {
    const nextIndex = index + 1
    if (nextIndex >= cards.length) {
      const roundSummary = summarizeBoardMatchRound({
        cards,
        brandChoiceIds,
        modelChoiceIds,
        pointsPerQuestion,
        streaksAfterEach,
      })
      const finalized = { ...roundSummary, totalPoints: roundPoints }
      setSummary(finalized)
      setCareer(recordBoardMatchRound(finalized.totalPoints))
      setPhase("results")
      return
    }
    setIndex(nextIndex)
    setSelectedBrandId(null)
    setSelectedModelId(null)
    setLastResult(null)
    setPlayStep("brand")
    setPhase("playing")
    pendingBrandId.current = null
    brandElapsedMsRef.current = 0
    brandStartedAt.current = Date.now()
  }

  const card = cards[index] ?? null
  const shopHref = boardMatchBrandHref(summary?.featuredBrand ?? null)
  const featuredLabel = summary?.featuredBrand?.name ?? null

  return (
    <main className="flex-1">
      <div className="relative overflow-hidden border-b border-border/80">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#d7e6ee_0%,_transparent_55%),linear-gradient(180deg,_#f4f8fa_0%,_#ffffff_70%)]"
        />
        <div className="relative container mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
          {phase === "intro" ? (
            <BoardMatchIntro
              career={career}
              onStart={startRound}
              unavailable={!deckReady}
              cardCount={initialCards.length}
            />
          ) : null}

          {(phase === "playing" || phase === "revealed") && card ? (
            <BoardMatchPlay
              card={card}
              index={index}
              total={cards.length}
              roundPoints={roundPoints}
              streak={streak}
              phase={phase}
              playStep={playStep}
              selectedBrandId={selectedBrandId}
              selectedModelId={selectedModelId}
              lastResult={lastResult}
              onPickBrand={onPickBrand}
              onPickModel={onPickModel}
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
            Photos come from real Reswell listings linked to catalog brands and models. Points
            stay on this device for now.{" "}
            <Link
              href="/brands"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Browse brands
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
