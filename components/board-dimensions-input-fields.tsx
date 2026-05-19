"use client"

import type { KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  normalizeBoardLengthInput,
  normalizeTapeStyleInchesInput,
  normalizeVolumeLitersInput,
  shouldShowLengthInchHint,
} from "@/lib/board-measurements"
import { siteFilterBorderedInputClassName } from "@/components/site-search-bar"
import { cn } from "@/lib/utils"

export type BoardDimensionsInputValues = {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
}

export const EMPTY_BOARD_DIMENSIONS_INPUT: BoardDimensionsInputValues = {
  boardLength: "",
  boardWidthInches: "",
  boardThicknessInches: "",
  boardVolumeL: "",
}

type BoardDimensionsInputFieldsProps = {
  values: BoardDimensionsInputValues
  onChange: (patch: Partial<BoardDimensionsInputValues>) => void
  className?: string
  idPrefix?: string
  onEnter?: () => void
  /** Sell flow styling (centered, compact). Filter variant matches /boards advanced filters. */
  variant?: "sell" | "filter"
}

function filterFieldLabelClassName() {
  return "text-xs font-medium text-foreground/90"
}

function filterInputClassName() {
  return cn(siteFilterBorderedInputClassName(), "rounded-full pl-3 pr-3")
}

function dimInputShellClassName() {
  return cn(
    "flex min-h-10 min-w-0 max-w-[11rem] flex-1 items-center justify-center gap-0.5 rounded-md border border-input bg-background px-1.5 shadow-sm ring-offset-background",
    "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
  )
}

function dimInputClassName() {
  return cn(
    "min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-base shadow-none tabular-nums placeholder:text-muted-foreground/45 focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm",
  )
}

export function BoardDimensionsInputFields({
  values,
  onChange,
  className,
  idPrefix = "board-dim",
  onEnter,
  variant = "sell",
}: BoardDimensionsInputFieldsProps) {
  function handleEnterKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      onEnter?.()
    }
  }

  if (variant === "filter") {
    return (
      <div className={cn("contents", className)}>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${idPrefix}-length`} className={filterFieldLabelClassName()}>
            Length
          </Label>
          <Input
            id={`${idPrefix}-length`}
            type="text"
            inputMode="text"
            placeholder="6'2"
            value={values.boardLength}
            onChange={(e) => onChange({ boardLength: normalizeBoardLengthInput(e.target.value) })}
            onKeyDown={handleEnterKey}
            className={filterInputClassName()}
            autoComplete="off"
            spellCheck={false}
            aria-label="Board length in feet and inches"
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${idPrefix}-width`} className={filterFieldLabelClassName()}>
            Width
          </Label>
          <Input
            id={`${idPrefix}-width`}
            type="text"
            inputMode="text"
            placeholder='19 1/4"'
            value={values.boardWidthInches}
            onChange={(e) =>
              onChange({ boardWidthInches: normalizeTapeStyleInchesInput(e.target.value) })
            }
            onKeyDown={handleEnterKey}
            className={filterInputClassName()}
            autoComplete="off"
            spellCheck={false}
            aria-label="Board width in inches"
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${idPrefix}-thickness`} className={filterFieldLabelClassName()}>
            Thickness
          </Label>
          <Input
            id={`${idPrefix}-thickness`}
            type="text"
            inputMode="text"
            placeholder='2 3/8"'
            value={values.boardThicknessInches}
            onChange={(e) =>
              onChange({ boardThicknessInches: normalizeTapeStyleInchesInput(e.target.value) })
            }
            onKeyDown={handleEnterKey}
            className={filterInputClassName()}
            autoComplete="off"
            spellCheck={false}
            aria-label="Board thickness in inches"
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${idPrefix}-volume`} className={filterFieldLabelClassName()}>
            Volume
          </Label>
          <Input
            id={`${idPrefix}-volume`}
            type="text"
            inputMode="text"
            placeholder="30.4 L"
            value={values.boardVolumeL}
            onChange={(e) =>
              onChange({ boardVolumeL: normalizeVolumeLitersInput(e.target.value) })
            }
            onKeyDown={handleEnterKey}
            className={filterInputClassName()}
            autoComplete="off"
            spellCheck={false}
            aria-label="Board volume in liters"
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-length`} className="text-xs text-muted-foreground/45">
          Length
        </Label>
        <div className="flex items-center gap-1">
          <div className={dimInputShellClassName()}>
            <Input
              id={`${idPrefix}-length`}
              type="text"
              inputMode="text"
              placeholder="6'2 or 6 2"
              value={values.boardLength}
              onChange={(e) => onChange({ boardLength: normalizeBoardLengthInput(e.target.value) })}
              onKeyDown={handleEnterKey}
              className={dimInputClassName()}
              autoComplete="off"
              spellCheck={false}
              aria-label="Board length in feet and inches"
              aria-describedby={
                shouldShowLengthInchHint(values.boardLength)
                  ? `${idPrefix}-length-inches-hint-sr`
                  : undefined
              }
            />
            {shouldShowLengthInchHint(values.boardLength) ? (
              <span id={`${idPrefix}-length-inches-hint-sr`} className="sr-only">
                Then type inches after the apostrophe (for example six foot two as 6&apos;2).
              </span>
            ) : null}
          </div>
          <span
            className="inline-flex w-5 shrink-0 items-center justify-center text-xs tabular-nums text-transparent select-none"
            aria-hidden
          >
            in
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-width`} className="text-xs text-muted-foreground/45">
          Width
        </Label>
        <div className="flex items-center gap-1">
          <div className={dimInputShellClassName()}>
            <Input
              id={`${idPrefix}-width`}
              type="text"
              inputMode="text"
              placeholder="19 1/4"
              value={values.boardWidthInches}
              onChange={(e) =>
                onChange({ boardWidthInches: normalizeTapeStyleInchesInput(e.target.value) })
              }
              onKeyDown={handleEnterKey}
              className={dimInputClassName()}
              autoComplete="off"
              spellCheck={false}
              aria-label="Board width in inches"
            />
          </div>
          <span className="inline-flex w-5 shrink-0 items-center justify-center text-xs text-muted-foreground/45 tabular-nums">
            in
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-thickness`} className="text-xs text-muted-foreground/45">
          Thickness
        </Label>
        <div className="flex items-center gap-1">
          <div className={dimInputShellClassName()}>
            <Input
              id={`${idPrefix}-thickness`}
              type="text"
              inputMode="text"
              placeholder="2 3/8"
              value={values.boardThicknessInches}
              onChange={(e) =>
                onChange({ boardThicknessInches: normalizeTapeStyleInchesInput(e.target.value) })
              }
              onKeyDown={handleEnterKey}
              className={dimInputClassName()}
              autoComplete="off"
              spellCheck={false}
              aria-label="Board thickness in inches"
            />
          </div>
          <span className="inline-flex w-5 shrink-0 items-center justify-center text-xs text-muted-foreground/45 tabular-nums">
            in
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-volume`} className="text-xs text-muted-foreground/45">
          Volume
        </Label>
        <div className="flex items-center gap-1">
          <div className={dimInputShellClassName()}>
            <Input
              id={`${idPrefix}-volume`}
              type="text"
              inputMode="text"
              placeholder="30.4"
              value={values.boardVolumeL}
              onChange={(e) =>
                onChange({ boardVolumeL: normalizeVolumeLitersInput(e.target.value) })
              }
              onKeyDown={handleEnterKey}
              className={dimInputClassName()}
              autoComplete="off"
              spellCheck={false}
              aria-label="Board volume in liters"
            />
          </div>
          <span className="inline-flex w-5 shrink-0 items-center justify-center text-xs text-muted-foreground/45 tabular-nums">
            L
          </span>
        </div>
      </div>
    </div>
  )
}
