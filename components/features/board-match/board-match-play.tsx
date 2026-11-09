"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { BoardMatchAnswerResult, BoardMatchPhase, BoardMatchScenario } from "@/lib/types/boardMatch"
import type { SurfboardSellCategoryKey } from "@/lib/surfboard-sell-categories"
import { SURFBOARD_SELL_CATEGORY_LABELS } from "@/lib/surfboard-sell-categories"

export function BoardMatchPlay({
  scenario,
  index,
  total,
  roundPoints,
  streak,
  phase,
  selected,
  lastResult,
  onPick,
  onContinue,
}: {
  scenario: BoardMatchScenario
  index: number
  total: number
  roundPoints: number
  streak: number
  phase: BoardMatchPhase
  selected: SurfboardSellCategoryKey | null
  lastResult: BoardMatchAnswerResult | null
  onPick: (choice: SurfboardSellCategoryKey) => void
  onContinue: () => void
}) {
  const revealed = phase === "revealed"

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-medium text-muted-foreground">
          {index + 1} / {total}
        </p>
        <div className="flex items-center gap-4 tabular-nums">
          <p>
            <span className="text-muted-foreground">Points </span>
            <span className="font-semibold text-foreground">{roundPoints}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Streak </span>
            <span className="font-semibold text-foreground">{streak}</span>
          </p>
        </div>
      </div>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-border/60"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={index + (revealed ? 1 : 0)}
        aria-label="Round progress"
      >
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-out"
          style={{ width: `${((index + (revealed ? 1 : 0)) / total) * 100}%` }}
        />
      </div>

      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Scenario
        </p>
        <h2 className="mt-2 font-headline text-3xl font-bold tracking-[-0.05em] text-foreground sm:text-4xl">
          {scenario.headline}
        </h2>
        <p className="mt-4 text-pretty text-base text-foreground/90">{scenario.session}</p>
        <p className="mt-2 text-pretty text-sm text-muted-foreground">{scenario.rider}</p>
      </div>

      <fieldset className="mt-8" disabled={revealed}>
        <legend className="sr-only">Choose a board type</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {scenario.choices.map((choice) => {
            const isSelected = selected === choice
            const isCorrect = choice === scenario.correct
            const showCorrect = revealed && isCorrect
            const showWrong = revealed && isSelected && !isCorrect

            return (
              <button
                key={choice}
                type="button"
                onClick={() => onPick(choice)}
                className={cn(
                  "min-h-touch rounded-xl border px-4 py-4 text-left transition-colors duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  !revealed && "border-border bg-background hover:border-foreground/30 hover:bg-muted/40",
                  showCorrect && "border-foreground bg-foreground text-primary-foreground",
                  showWrong && "border-destructive/50 bg-destructive/5 text-foreground",
                  revealed && !showCorrect && !showWrong && "border-border/60 bg-muted/30 text-muted-foreground",
                )}
              >
                <span className="font-headline text-lg font-semibold tracking-tight">
                  {SURFBOARD_SELL_CATEGORY_LABELS[choice]}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {revealed && lastResult ? (
        <div
          className="mt-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
          role="status"
          aria-live="polite"
        >
          <p className="font-headline text-xl font-bold tracking-tight">
            {lastResult.correct ? "Nice match" : "Not quite"}
          </p>
          <p className="mt-2 text-pretty text-sm text-muted-foreground">{scenario.why}</p>
          {lastResult.correct ? (
            <p className="mt-3 text-sm tabular-nums text-foreground">
              +{lastResult.pointsEarned} points
              {lastResult.speedBonus > 0 ? (
                <span className="text-muted-foreground"> · {lastResult.speedBonus} speed</span>
              ) : null}
              {lastResult.streakBonus > 0 ? (
                <span className="text-muted-foreground"> · {lastResult.streakBonus} streak</span>
              ) : null}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Answer: {SURFBOARD_SELL_CATEGORY_LABELS[scenario.correct]}
            </p>
          )}
          <Button type="button" className="mt-5" onClick={onContinue}>
            {index + 1 >= total ? "See results" : "Next scenario"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
