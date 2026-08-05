"use client"

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
} from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  BOARD_LENGTH_FOCUS_VALUE,
  BOARD_LENGTH_OPTIONS,
  BOARD_THICKNESS_FOCUS_VALUE,
  BOARD_THICKNESS_OPTIONS,
  BOARD_WIDTH_FOCUS_VALUE,
  BOARD_WIDTH_OPTIONS,
  formatBoardLengthPickerLabel,
  formatInchesFractionLabel,
  matchBoardInchesOptionValue,
  matchBoardLengthOptionValue,
  withCurrentDimensionOption,
  type BoardDimensionOption,
} from "@/lib/board-dimension-options"
import {
  normalizeVolumeLitersInput,
  parseBoardMeasurement,
} from "@/lib/board-measurements"
import { cn } from "@/lib/utils"

export type SellBoardDimensionsPickerValues = {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
}

type SellBoardDimensionsPickerProps = {
  values: SellBoardDimensionsPickerValues
  onChange: (patch: Partial<SellBoardDimensionsPickerValues>) => void
  className?: string
  /** When shipping is on, length/width/thickness are required. */
  dimensionsRequired?: boolean
  disabled?: boolean
  volumeInputRef?: Ref<HTMLInputElement>
}

const DIM_ITEM_HEIGHT_PX = 40
const DIM_MENU_MAX_HEIGHT_PX = 300
const DIM_MENU_GAP_PX = 6
/** Wide enough that labels like `12' 0"` / `19 7/8"` never wrap. */
const DIM_MENU_MIN_WIDTH_PX = 136

function segmentTriggerClassName(open: boolean) {
  return cn(
    "flex h-12 w-full items-center justify-center gap-1 rounded-none border-0 bg-background px-1.5 text-center text-sm font-medium tabular-nums text-foreground shadow-none ring-offset-0",
    "hover:bg-muted/40 transition-colors",
    "focus:z-10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset",
    "disabled:cursor-not-allowed disabled:opacity-50",
    open && "relative z-[86] bg-muted/50",
  )
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** Anchored dropdown: attached directly below the field (flips above when cramped). */
function computeDimMenuLayout(input: {
  trigger: DOMRect
  optionsCount: number
  anchorIndex: number
}): { style: CSSProperties; scrollTop: number } {
  const contentHeight = input.optionsCount * DIM_ITEM_HEIGHT_PX
  const spaceBelow = window.innerHeight - input.trigger.bottom - DIM_MENU_GAP_PX - 8
  const spaceAbove = input.trigger.top - DIM_MENU_GAP_PX - 8

  const openUp = spaceBelow < 200 && spaceAbove > spaceBelow
  const available = openUp ? spaceAbove : spaceBelow
  const listHeight = Math.round(
    Math.min(DIM_MENU_MAX_HEIGHT_PX, contentHeight, Math.max(available, 160)),
  )

  const top = openUp
    ? input.trigger.top - DIM_MENU_GAP_PX - listHeight
    : input.trigger.bottom + DIM_MENU_GAP_PX

  const menuWidth = Math.max(Math.round(input.trigger.width), DIM_MENU_MIN_WIDTH_PX)
  const idealLeft =
    menuWidth > input.trigger.width + 0.5
      ? input.trigger.left + input.trigger.width / 2 - menuWidth / 2
      : input.trigger.left
  const left = clamp(Math.round(idealLeft), 8, window.innerWidth - menuWidth - 8)

  // Pre-scroll so the anchor row is vertically centered in the list viewport.
  const anchorCenter = input.anchorIndex * DIM_ITEM_HEIGHT_PX + DIM_ITEM_HEIGHT_PX / 2
  const scrollTop = clamp(
    anchorCenter - listHeight / 2,
    0,
    Math.max(0, contentHeight - listHeight),
  )

  return {
    style: {
      position: "fixed",
      top: Math.round(clamp(top, 8, window.innerHeight - listHeight - 8)),
      left,
      width: menuWidth,
      height: listHeight,
      zIndex: 85,
    },
    scrollTop,
  }
}

function DimSelect({
  value,
  onValueChange,
  options,
  focusValue,
  placeholder,
  ariaLabel,
  disabled,
  required,
}: {
  value: string
  onValueChange: (next: string) => void
  options: BoardDimensionOption[]
  /** Center the list on this value when nothing is committed yet. */
  focusValue: string
  placeholder: string
  ariaLabel: string
  disabled?: boolean
  required?: boolean
}) {
  const listId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)

  const committed = value.trim()
  const anchorValue = committed || focusValue
  const anchorIndex = Math.max(
    0,
    options.findIndex((o) => o.value === anchorValue),
  )
  const displayLabel = useMemo(() => {
    if (!committed) return ""
    return options.find((o) => o.value === committed)?.label ?? committed
  }, [committed, options])

  const applyLayout = useCallback(
    (withScroll: boolean) => {
      const trigger = triggerRef.current
      if (!trigger) return
      const layout = computeDimMenuLayout({
        trigger: trigger.getBoundingClientRect(),
        optionsCount: options.length,
        anchorIndex,
      })
      setMenuStyle(layout.style)
      if (withScroll) {
        // Double rAF: the portal mounts on the commit after setOpen/setMenuStyle.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (listRef.current) listRef.current.scrollTop = layout.scrollTop
          })
        })
      }
    },
    [anchorIndex, options.length],
  )

  const closeMenu = useCallback(
    (refocus = false) => {
      setOpen(false)
      setMenuStyle(null)
      setActiveIndex(-1)
      if (refocus) triggerRef.current?.focus()
    },
    [],
  )

  const openMenu = () => {
    setActiveIndex(anchorIndex)
    applyLayout(true)
    setOpen(true)
  }

  const commitIndex = (index: number) => {
    const opt = options[index]
    if (!opt) return
    onValueChange(opt.value)
    closeMenu(true)
  }

  // Keep the menu attached while the page scrolls or resizes (no re-centering).
  useEffect(() => {
    if (!open) return
    const onReposition = () => applyLayout(false)
    window.addEventListener("resize", onReposition)
    window.addEventListener("scroll", onReposition, true)
    return () => {
      window.removeEventListener("resize", onReposition)
      window.removeEventListener("scroll", onReposition, true)
    }
  }, [open, applyLayout])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return
      closeMenu()
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open, closeMenu])

  const scrollRowIntoView = (index: number) => {
    const list = listRef.current
    if (!list) return
    const rowTop = index * DIM_ITEM_HEIGHT_PX
    const rowBottom = rowTop + DIM_ITEM_HEIGHT_PX
    if (rowTop < list.scrollTop) list.scrollTop = rowTop
    else if (rowBottom > list.scrollTop + list.clientHeight)
      list.scrollTop = rowBottom - list.clientHeight
  }

  const onTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault()
        closeMenu(true)
        break
      case "ArrowDown": {
        e.preventDefault()
        const next = Math.min(options.length - 1, (activeIndex < 0 ? anchorIndex : activeIndex) + 1)
        setActiveIndex(next)
        scrollRowIntoView(next)
        break
      }
      case "ArrowUp": {
        e.preventDefault()
        const next = Math.max(0, (activeIndex < 0 ? anchorIndex : activeIndex) - 1)
        setActiveIndex(next)
        scrollRowIntoView(next)
        break
      }
      case "Enter":
      case " ":
        e.preventDefault()
        commitIndex(activeIndex < 0 ? anchorIndex : activeIndex)
        break
      case "Tab":
        closeMenu()
        break
    }
  }

  return (
    <div className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={segmentTriggerClassName(open)}
        onClick={() => {
          if (disabled) return
          if (open) closeMenu()
          else openMenu()
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span
          className={cn(
            "min-w-0 truncate text-center tabular-nums",
            !displayLabel && "text-muted-foreground/55",
          )}
        >
          {displayLabel || placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-150",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && menuStyle
        ? createPortal(
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              style={menuStyle}
              className="overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
            >
              {options.map((opt, index) => {
                const isCommitted = committed === opt.value
                const isActive = index === activeIndex
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isCommitted}
                    tabIndex={-1}
                    className={cn(
                      "flex w-full shrink-0 items-center gap-2 whitespace-nowrap px-3 text-sm tabular-nums outline-none transition-colors",
                      "hover:bg-muted",
                      isActive && "bg-muted",
                      isCommitted && "font-semibold",
                    )}
                    style={{ height: DIM_ITEM_HEIGHT_PX }}
                    onPointerMove={() => {
                      if (activeIndex !== index) setActiveIndex(index)
                    }}
                    onClick={() => commitIndex(index)}
                  >
                    <span className="inline-flex w-4 shrink-0 items-center justify-center">
                      {isCommitted ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                    </span>
                    <span className="min-w-0 flex-1 text-center">{opt.label}</span>
                    <span className="w-4 shrink-0" aria-hidden />
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function displayInchesOrRaw(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  const n = parseBoardMeasurement(t)
  if (n != null) return formatInchesFractionLabel(n)
  return t.endsWith('"') ? t : `${t}"`
}

export function SellBoardDimensionsPicker({
  values,
  onChange,
  className,
  dimensionsRequired = false,
  disabled = false,
  volumeInputRef,
}: SellBoardDimensionsPickerProps) {
  const lengthOptions = useMemo(
    () => withCurrentDimensionOption(BOARD_LENGTH_OPTIONS, values.boardLength, "length"),
    [values.boardLength],
  )
  const widthOptions = useMemo(
    () => withCurrentDimensionOption(BOARD_WIDTH_OPTIONS, values.boardWidthInches, "inches"),
    [values.boardWidthInches],
  )
  const thicknessOptions = useMemo(
    () =>
      withCurrentDimensionOption(BOARD_THICKNESS_OPTIONS, values.boardThicknessInches, "inches"),
    [values.boardThicknessInches],
  )

  const lengthValue =
    matchBoardLengthOptionValue(values.boardLength, lengthOptions) ??
    (values.boardLength.trim() || "")
  const widthValue =
    matchBoardInchesOptionValue(values.boardWidthInches, widthOptions) ??
    (values.boardWidthInches.trim() || "")
  const thicknessValue =
    matchBoardInchesOptionValue(values.boardThicknessInches, thicknessOptions) ??
    (values.boardThicknessInches.trim() || "")

  const lengthDisplay = lengthValue
    ? formatBoardLengthPickerLabel(lengthValue) || lengthValue
    : ""
  const widthDisplay = widthValue ? displayInchesOrRaw(widthValue) : ""
  const thicknessDisplay = thicknessValue ? displayInchesOrRaw(thicknessValue) : ""

  return (
    <div className={cn("space-y-2", className)} data-sell-board-dims="ci-picker">
      <div className="grid grid-cols-4 gap-x-2 text-xs text-muted-foreground">
        <Label className="text-xs font-medium text-muted-foreground">
          Length
          {dimensionsRequired ? (
            <span className="text-destructive" aria-hidden="true">
              {" "}
              *
            </span>
          ) : null}
        </Label>
        <Label className="text-xs font-medium text-muted-foreground">
          Width
          {dimensionsRequired ? (
            <span className="text-destructive" aria-hidden="true">
              {" "}
              *
            </span>
          ) : null}
        </Label>
        <Label className="text-xs font-medium text-muted-foreground">
          Thickness
          {dimensionsRequired ? (
            <span className="text-destructive" aria-hidden="true">
              {" "}
              *
            </span>
          ) : null}
        </Label>
        <Label className="text-xs font-medium text-muted-foreground">Volume</Label>
      </div>

      <div
        className={cn(
          "grid grid-cols-4 overflow-hidden rounded-md border border-foreground/25 bg-background shadow-sm",
          "divide-x divide-foreground/25",
        )}
      >
        <DimSelect
          value={lengthValue}
          onValueChange={(next) => onChange({ boardLength: next })}
          options={lengthOptions}
          focusValue={BOARD_LENGTH_FOCUS_VALUE}
          placeholder="—"
          ariaLabel="Board length"
          disabled={disabled}
          required={dimensionsRequired}
        />
        <DimSelect
          value={widthValue}
          onValueChange={(next) => onChange({ boardWidthInches: next })}
          options={widthOptions}
          focusValue={BOARD_WIDTH_FOCUS_VALUE}
          placeholder="—"
          ariaLabel="Board width in inches"
          disabled={disabled}
          required={dimensionsRequired}
        />
        <DimSelect
          value={thicknessValue}
          onValueChange={(next) => onChange({ boardThicknessInches: next })}
          options={thicknessOptions}
          focusValue={BOARD_THICKNESS_FOCUS_VALUE}
          placeholder="—"
          ariaLabel="Board thickness in inches"
          disabled={disabled}
          required={dimensionsRequired}
        />

        <div
          className={cn(
            "relative flex h-12 min-w-0 items-center justify-center bg-foreground px-1.5",
            "focus-within:z-10 focus-within:ring-2 focus-within:ring-ring focus-within:ring-inset",
          )}
        >
          <Input
            ref={volumeInputRef}
            type="text"
            inputMode="decimal"
            placeholder="— L"
            value={values.boardVolumeL}
            disabled={disabled}
            onChange={(e) =>
              onChange({ boardVolumeL: normalizeVolumeLitersInput(e.target.value) })
            }
            className={cn(
              "h-full min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-sm font-medium tabular-nums text-background shadow-none",
              "placeholder:text-background/45 focus-visible:ring-0 focus-visible:ring-offset-0",
              "disabled:cursor-not-allowed disabled:opacity-50",
              values.boardVolumeL.trim() && "pr-5",
            )}
            autoComplete="off"
            spellCheck={false}
            aria-label="Board volume in liters"
          />
          {values.boardVolumeL.trim() ? (
            <span
              className="pointer-events-none absolute right-2 text-[10px] font-semibold uppercase tracking-wide text-background/70"
              aria-hidden
            >
              L
            </span>
          ) : null}
        </div>
      </div>

      <p className="sr-only">
        {[
          lengthDisplay,
          widthDisplay,
          thicknessDisplay,
          values.boardVolumeL.trim() ? `${values.boardVolumeL.trim()} L` : "",
        ]
          .filter(Boolean)
          .join(" · ") || "No dimensions selected"}
      </p>
    </div>
  )
}
