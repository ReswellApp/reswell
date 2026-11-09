"use client"

import Image from "next/image"

import { Button } from "@/components/ui/button"
import { isConfiguredNextImageSrc } from "@/lib/brands/logo-mark"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"
import type {
  BoardMatchAnswerResult,
  BoardMatchCard,
  BoardMatchPhase,
  BoardMatchPlayStep,
} from "@/lib/types/boardMatch"

export function BoardMatchPlay({
  card,
  index,
  total,
  roundPoints,
  streak,
  phase,
  playStep,
  selectedBrandId,
  selectedModelId,
  lastResult,
  onPickBrand,
  onPickModel,
  onContinue,
}: {
  card: BoardMatchCard
  index: number
  total: number
  roundPoints: number
  streak: number
  phase: BoardMatchPhase
  playStep: BoardMatchPlayStep
  selectedBrandId: string | null
  selectedModelId: string | null
  lastResult: BoardMatchAnswerResult | null
  onPickBrand: (brandId: string) => void
  onPickModel: (modelId: string) => void
  onContinue: () => void
}) {
  const revealed = phase === "revealed"
  const imageSrc = isConfiguredNextImageSrc(card.imageUrl) ? card.imageUrl : null
  const choosingModel = playStep === "model" && !revealed
  const showBrandChoices = playStep === "brand" || (revealed && !lastResult?.brandCorrect)
  const showModelChoices = playStep === "model" || (revealed && !!lastResult?.brandCorrect)

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

      <div className="relative mt-6 aspect-[4/3] overflow-hidden rounded-2xl bg-muted/40 ring-1 ring-border/60">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt="Surfboard from the Reswell catalog"
            fill
            priority={index === 0}
            sizes="(max-width: 672px) 100vw, 42rem"
            className="object-cover"
            unoptimized={listingImageShouldBypassOptimization(imageSrc)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Photo unavailable
          </div>
        )}
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {choosingModel ? "Bonus · name the model" : "Which brand is this?"}
        </p>
        <h2 className="mt-2 font-headline text-2xl font-bold tracking-[-0.05em] text-foreground sm:text-3xl">
          {choosingModel
            ? `Brand locked: ${card.brand.name}`
            : revealed
              ? `${card.brand.name} · ${card.model.name}`
              : "Match the brand"}
        </h2>
      </div>

      {showBrandChoices ? (
        <fieldset className="mt-6" disabled={revealed}>
          <legend className="sr-only">Choose a brand</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {card.brandChoices.map((choice) => {
              const isSelected = selectedBrandId === choice.id
              const isCorrect = choice.id === card.brand.id
              const showCorrect = revealed && isCorrect
              const showWrong = revealed && isSelected && !isCorrect

              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => onPickBrand(choice.id)}
                  className={cn(
                    "min-h-touch rounded-xl border px-4 py-4 text-left transition-colors duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    !revealed &&
                      "border-border bg-background hover:border-foreground/30 hover:bg-muted/40",
                    showCorrect && "border-foreground bg-foreground text-primary-foreground",
                    showWrong && "border-destructive/50 bg-destructive/5 text-foreground",
                    revealed &&
                      !showCorrect &&
                      !showWrong &&
                      "border-border/60 bg-muted/30 text-muted-foreground",
                  )}
                >
                  <span className="font-headline text-lg font-semibold tracking-tight">
                    {choice.name}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      {showModelChoices ? (
        <fieldset className="mt-6" disabled={revealed}>
          <legend className="sr-only">Choose a model name</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {card.modelChoices.map((choice) => {
              const isSelected = selectedModelId === choice.id
              const isCorrect = choice.id === card.model.id
              const showCorrect = revealed && isCorrect
              const showWrong = revealed && isSelected && !isCorrect

              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => onPickModel(choice.id)}
                  className={cn(
                    "min-h-touch rounded-xl border px-4 py-4 text-left transition-colors duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    !revealed &&
                      "border-border bg-background hover:border-foreground/30 hover:bg-muted/40",
                    showCorrect && "border-foreground bg-foreground text-primary-foreground",
                    showWrong && "border-destructive/50 bg-destructive/5 text-foreground",
                    revealed &&
                      !showCorrect &&
                      !showWrong &&
                      "border-border/60 bg-muted/30 text-muted-foreground",
                  )}
                >
                  <span className="font-headline text-lg font-semibold tracking-tight">
                    {choice.name}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      {revealed && lastResult ? (
        <div
          className="mt-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
          role="status"
          aria-live="polite"
        >
          <p className="font-headline text-xl font-bold tracking-tight">
            {!lastResult.brandCorrect
              ? "Brand miss"
              : lastResult.modelCorrect
                ? "Brand + model"
                : "Brand locked · model miss"}
          </p>
          <p className="mt-2 text-pretty text-sm text-muted-foreground">
            {card.brand.name} · {card.model.name}
          </p>
          {lastResult.pointsEarned > 0 ? (
            <p className="mt-3 text-sm tabular-nums text-foreground">
              +{lastResult.pointsEarned} points
              {lastResult.modelBonus > 0 ? (
                <span className="text-muted-foreground"> · {lastResult.modelBonus} model</span>
              ) : null}
              {lastResult.speedBonus > 0 ? (
                <span className="text-muted-foreground"> · {lastResult.speedBonus} speed</span>
              ) : null}
              {lastResult.streakBonus > 0 ? (
                <span className="text-muted-foreground"> · {lastResult.streakBonus} streak</span>
              ) : null}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No points this board</p>
          )}
          <Button type="button" className="mt-5" onClick={onContinue}>
            {index + 1 >= total ? "See results" : "Next board"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
