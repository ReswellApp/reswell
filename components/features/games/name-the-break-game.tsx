"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import confetti from "canvas-confetti"
import { Check, Lightbulb, Share2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildNameTheBreakRounds } from "@/lib/games/name-the-break/build-rounds"
import type { NameTheBreakRound } from "@/lib/games/name-the-break/types"
import { cn } from "@/lib/utils"

type Phase = "intro" | "playing" | "reveal" | "results"

function scoreLine(score: number, total: number): string {
  if (score === total) return "Perfect lineup."
  if (score >= total - 1) return "Local knowledge."
  if (score >= Math.ceil(total / 2)) return "Solid session."
  return "Still learning the map."
}

export function NameTheBreakGame() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [rounds, setRounds] = useState<NameTheBreakRound[]>([])
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [hintOpen, setHintOpen] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)

  const current = rounds[index] ?? null
  const total = rounds.length

  function startGame() {
    setRounds(buildNameTheBreakRounds())
    setIndex(0)
    setScore(0)
    setPicked(null)
    setHintOpen(false)
    setShareNote(null)
    setPhase("playing")
  }

  function answer(choice: string) {
    if (!current || phase !== "playing") return
    setPicked(choice)
    if (choice === current.challenge.name) {
      setScore((s) => s + 1)
    }
    setPhase("reveal")
  }

  function nextRound() {
    if (index + 1 >= total) {
      setPhase("results")
      return
    }
    setIndex((i) => i + 1)
    setPicked(null)
    setHintOpen(false)
    setPhase("playing")
  }

  useEffect(() => {
    if (phase !== "results" || total === 0 || score < total) return
    confetti({
      particleCount: 70,
      spread: 64,
      origin: { y: 0.7 },
      colors: ["#0f172a", "#94a3b8", "#e2e8f0", "#38bdf8"],
    })
  }, [phase, score, total])

  async function shareScore() {
    const text = `I scored ${score}/${total} on Reswell Name the Break — ${scoreLine(score, total)}`
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/name-the-break` : "/name-the-break"
    try {
      if (navigator.share) {
        await navigator.share({ title: "Name the Break", text, url })
        return
      }
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setShareNote("Copied to clipboard")
    } catch {
      setShareNote("Could not share — copy the URL instead")
    }
  }

  if (phase === "intro") {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <div className="space-y-3">
          <p className="font-headline text-sm font-medium tracking-[-0.04em] text-foreground">
            Reswell
          </p>
          <h1 className="font-headline text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-5xl">
            Name the Break
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Look at the photo. Pick the surf break. Eight rounds, one streak of coastal literacy.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="lg" onClick={startGame}>
            Play
          </Button>
          <p className="text-sm text-muted-foreground">Multiple choice · optional region hint</p>
        </div>
      </section>
    )
  }

  if (phase === "results") {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Session complete</p>
          <h2 className="font-headline text-4xl font-bold tracking-[-0.05em] text-foreground">
            {score}/{total}
          </h2>
          <p className="text-lg text-muted-foreground">{scoreLine(score, total)}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" size="lg" onClick={startGame}>
            Play again
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={shareScore}>
            <Share2 className="size-4" />
            Share score
          </Button>
          <Button type="button" size="lg" variant="secondary" asChild>
            <Link href="/boards">Browse boards</Link>
          </Button>
        </div>
        {shareNote ? <p className="text-sm text-muted-foreground">{shareNote}</p> : null}
      </section>
    )
  }

  if (!current) return null

  const { challenge, choices } = current
  const correct = picked === challenge.name

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-headline text-sm font-medium tracking-[-0.04em] text-foreground">
            Name the Break
          </p>
          <p className="text-sm text-muted-foreground">
            Round {index + 1} of {total} · Score {score}
          </p>
        </div>
        {phase === "playing" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setHintOpen(true)}
            disabled={hintOpen}
          >
            <Lightbulb className="size-4" />
            {hintOpen ? `${challenge.region}, ${challenge.country}` : "Hint"}
          </Button>
        ) : null}
      </div>

      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        <Image
          src={challenge.imageUrl}
          alt={`Surf photo for round ${index + 1}`}
          fill
          priority
          sizes="(max-width: 896px) 100vw, 896px"
          className="object-cover"
        />
      </div>

      <div className="space-y-1">
        <h2 className="font-headline text-2xl font-bold tracking-[-0.04em] text-foreground sm:text-3xl">
          {phase === "reveal" ? challenge.name : "Where is this?"}
        </h2>
        {phase === "reveal" ? (
          <p className="text-sm text-muted-foreground">
            {challenge.region}, {challenge.country}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((choice) => {
          const isCorrectChoice = choice === challenge.name
          const isPicked = choice === picked
          return (
            <button
              key={choice}
              type="button"
              disabled={phase !== "playing"}
              onClick={() => answer(choice)}
              className={cn(
                "flex min-h-12 items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-medium tracking-[-0.02em] transition-colors",
                phase === "playing" && "border-border bg-background text-foreground hover:bg-muted",
                phase === "reveal" && isCorrectChoice && "border-foreground bg-foreground text-primary-foreground",
                phase === "reveal" && isPicked && !isCorrectChoice && "border-destructive/40 bg-destructive/10 text-foreground",
                phase === "reveal" && !isCorrectChoice && !isPicked && "border-border bg-muted/40 text-muted-foreground",
              )}
            >
              <span>{choice}</span>
              {phase === "reveal" && isCorrectChoice ? <Check className="size-4 shrink-0" /> : null}
              {phase === "reveal" && isPicked && !isCorrectChoice ? (
                <X className="size-4 shrink-0" />
              ) : null}
            </button>
          )
        })}
      </div>

      {phase === "reveal" ? (
        <div className="space-y-4 border-t border-border pt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              {correct ? "Correct. " : "Not quite. "}
            </span>
            {challenge.fact}
          </p>
          <p className="text-xs text-muted-foreground">
            Photo: {challenge.imageCredit} · {challenge.imageLicense} ·{" "}
            <a
              href={challenge.imageSourceUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              source
            </a>
          </p>
          <Button type="button" size="lg" onClick={nextRound}>
            {index + 1 >= total ? "See results" : "Next break"}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
