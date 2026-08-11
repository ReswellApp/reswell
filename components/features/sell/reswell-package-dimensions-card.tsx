"use client"

import { useId, useState, type HTMLAttributes, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { FedExMark, UpsMark, UspsMark } from "@/components/features/sell/carrier-mark-icons"
import { SellRequiredMark } from "@/components/features/sell/sell-required-mark"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
  parseReswellPackedWeightToTotalOz,
} from "@/lib/reswell-parcel-fields"
import {
  SURFBOARD_LABEL_MAX_WEIGHT_LB,
  UPS_MAX_LENGTH_PLUS_GIRTH_IN,
  surfboardShippingDimIn,
} from "@/lib/shipping/surfboard-label-limits"

export interface ReswellPackageDimensionsCardProps {
  className?: string
  /** When false, omit the inner title + intro (e.g. parent section already has a heading). */
  showHeading?: boolean
  /**
   * Exact carton mode: quotes use entered outer box as-is (no packing pad copy).
   */
  exactCartonMode?: boolean
  /** Outer packed length placeholder. */
  lengthPlaceholder?: string
  lengthIn: string
  widthIn: string
  heightIn: string
  weightLb: string
  weightOz: string
  onLengthInChange: (value: string) => void
  onWidthInChange: (value: string) => void
  onHeightInChange: (value: string) => void
  onWeightLbChange: (value: string) => void
  onWeightOzChange: (value: string) => void
}

/** Compact cell: label inside the field so L/W/H can sit in one row on mobile. */
function CompactCell({
  id,
  label,
  value,
  onChange,
  placeholder,
  inputMode = "decimal",
  requiredComplete,
  className,
}: {
  id: string
  label: ReactNode
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"]
  /** When set, shows the sell-form required mark (red * → check when complete). */
  requiredComplete?: boolean
  className?: string
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-w-0 flex-1 cursor-text flex-col gap-0.5 px-2.5 py-1.5 sm:px-3 sm:py-2",
        className,
      )}
    >
      <span className="flex items-center gap-1 text-[10px] font-medium leading-none text-muted-foreground sm:text-[11px]">
        {label}
        {requiredComplete !== undefined ? (
          <SellRequiredMark complete={requiredComplete} className="h-3 w-3 text-[11px]" />
        ) : null}
      </span>
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 border-0 bg-transparent p-0 text-sm tabular-nums text-foreground outline-none placeholder:text-muted-foreground/45 sm:text-base"
      />
    </label>
  )
}

/** Pirate Ship–style Length + Girth oversize copy. */
export function packageLengthPlusGirthTooBigMessage(dimTotal: number): string {
  return `Your package is too big! The maximum Length plus Girth (Width x 2 + Height x 2) is ${UPS_MAX_LENGTH_PLUS_GIRTH_IN}", but your package is ${Math.round(dimTotal)}"`
}

const MEASUREMENT_TIPS = [
  {
    title: "Measure the outer box",
    body: "Use the outside of the packed bag or carton — not the bare board. Carriers bill the package you hand them.",
  },
  {
    title: "Length, width, and height",
    body: "Length is the longest side. Width and height are the other two sides. Enter all three in inches.",
  },
  {
    title: "Length + girth limit",
    body: `UPS Ground requires Length + (2 × Width) + (2 × Height) to be ${UPS_MAX_LENGTH_PLUS_GIRTH_IN}" or less. We’ll flag the fields if you go over.`,
  },
  {
    title: "Include packing weight",
    body: `Weigh the fully packed board (box, padding, and board). Reswell labels stay at ${SURFBOARD_LABEL_MAX_WEIGHT_LB} lb or less.`,
  },
] as const

function MeasurementTipsTrigger({ label }: { label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="font-medium text-foreground underline underline-offset-2 hover:text-listingHeart"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className="max-h-[min(92vh,36rem)] w-full max-w-[min(100vw-1.5rem,28rem)] gap-0 overflow-hidden rounded-xl p-0 sm:max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="space-y-1 border-b border-border px-5 pb-4 pt-5 pr-12 text-left sm:px-6">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Measurement tips
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Accurate box size and weight keep checkout rates honest and avoid carrier
              adjustments after the sale.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(60vh,22rem)] space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
            {MEASUREMENT_TIPS.map((tip) => (
              <div
                key={tip.title}
                className="rounded-lg border border-border/80 bg-muted/30 px-3.5 py-3"
              >
                <p className="text-sm font-semibold text-foreground">{tip.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tip.body}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Compact packed L×W×H + lb/oz entry (Pirate Ship–style on mobile) with DIM oversize feedback.
 */
export function ReswellPackageDimensionsCard({
  className,
  showHeading = true,
  exactCartonMode = false,
  lengthPlaceholder = "0",
  lengthIn,
  widthIn,
  heightIn,
  weightLb,
  weightOz,
  onLengthInChange,
  onWidthInChange,
  onHeightInChange,
  onWeightLbChange,
  onWeightOzChange,
}: ReswellPackageDimensionsCardProps) {
  const uid = useId()
  const lengthId = `${uid}-length`
  const widthId = `${uid}-width`
  const heightId = `${uid}-height`
  const lbId = `${uid}-lb`
  const ozId = `${uid}-oz`
  const dimsErrorId = `${uid}-dims-error`

  const L = parseReswellParcelLengthRawToCarrierInches(lengthIn)
  const W = parseReswellParcelWidthHeightRawToCarrierInches(widthIn)
  const H = parseReswellParcelWidthHeightRawToCarrierInches(heightIn)
  const dimTotal =
    L != null && W != null && H != null ? surfboardShippingDimIn(L, W, H) : null
  const dimsTooBig = dimTotal != null && dimTotal > UPS_MAX_LENGTH_PLUS_GIRTH_IN

  const totalOz = parseReswellPackedWeightToTotalOz(weightLb, weightOz)
  const weightTooBig =
    totalOz != null && totalOz / 16 > SURFBOARD_LABEL_MAX_WEIGHT_LB
  const lengthComplete = L != null && L > 0
  const widthComplete = W != null && W > 0
  const heightComplete = H != null && H > 0
  const weightComplete = totalOz != null && totalOz > 0 && !weightTooBig

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:space-y-4 sm:p-5",
        className,
      )}
    >
      {showHeading ? (
        <div className="space-y-0.5 sm:space-y-1">
          <h3 className="text-sm font-semibold text-foreground sm:text-base">
            Package size and weight{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </h3>
          <p className="text-xs text-muted-foreground leading-snug sm:text-sm sm:leading-relaxed">
            <span className="sm:hidden">
              Outer box you&apos;ll ship in. <MeasurementTipsTrigger label="Tips" />
            </span>
            <span className="hidden sm:inline">
              {exactCartonMode
                ? "Enter the exact outer box you'll ship in. Inaccurate measurements may incur additional charges from the carrier. "
                : "Inaccurate measurements may incur additional charges from the carrier. "}
              <MeasurementTipsTrigger label="Measurement tips" />
            </span>
          </p>
        </div>
      ) : null}

      {/* Boards: UPS or FedEx. Other categories: UPS + USPS weight guidance. */}
      <div className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-xs leading-snug text-foreground/90 sm:space-y-2.5 sm:px-3.5 sm:py-3 sm:text-sm sm:leading-relaxed">
        {exactCartonMode ? (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5">
              <UpsMark className="h-6 min-w-[2.25rem] scale-90 text-[8px] sm:h-8 sm:min-w-[2.75rem] sm:scale-100 sm:text-[9px]" />
              <FedExMark className="h-6 scale-90 sm:h-8 sm:scale-100 [&>span]:px-1.5 [&>span]:py-1.5 sm:[&>span]:px-2 sm:[&>span]:py-2.5" />
            </div>
            <p className="min-w-0">
              <span className="sm:hidden">Ships via UPS or FedEx</span>
              <span className="hidden sm:inline">
                Surfboards ship via UPS or FedEx using the box size you enter
              </span>
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 sm:gap-3">
              <UpsMark className="h-6 min-w-[2.25rem] scale-90 text-[8px] sm:h-8 sm:min-w-[2.75rem] sm:scale-100 sm:text-[9px]" />
              <p className="min-w-0">
                <span className="sm:hidden">Over 10 lb → UPS</span>
                <span className="hidden sm:inline">Most items over 10 lbs ship via UPS</span>
              </p>
            </div>
            <div className="mt-1.5 flex items-center gap-2 sm:mt-0 sm:gap-3">
              <UspsMark className="h-6 min-w-[2.25rem] scale-90 text-[8px] sm:h-8 sm:min-w-[2.75rem] sm:scale-100 sm:text-[9px]" />
              <p className="min-w-0">
                <span className="sm:hidden">Under 10 lb → USPS</span>
                <span className="hidden sm:inline">Most items under 10 lbs ship via USPS</span>
              </p>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] sm:gap-5">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">
            Dimensions (Inches)
          </p>
          <div
            className={cn(
              "flex overflow-hidden rounded-md border bg-background",
              dimsTooBig ? "border-destructive" : "border-border",
            )}
            aria-describedby={dimsTooBig ? dimsErrorId : undefined}
          >
            <CompactCell
              id={lengthId}
              label="Length"
              value={lengthIn}
              onChange={onLengthInChange}
              placeholder={lengthPlaceholder}
              requiredComplete={lengthComplete}
            />
            <div className="w-px shrink-0 self-stretch bg-border" aria-hidden />
            <CompactCell
              id={widthId}
              label="Width"
              value={widthIn}
              onChange={onWidthInChange}
              placeholder="0"
              requiredComplete={widthComplete}
            />
            <div className="w-px shrink-0 self-stretch bg-border" aria-hidden />
            <CompactCell
              id={heightId}
              label="Height"
              value={heightIn}
              onChange={onHeightInChange}
              placeholder="0"
              requiredComplete={heightComplete}
            />
          </div>
          {dimsTooBig && dimTotal != null ? (
            <p
              id={dimsErrorId}
              className="text-xs font-medium leading-snug text-destructive sm:text-sm"
              role="alert"
            >
              {packageLengthPlusGirthTooBigMessage(dimTotal)}
            </p>
          ) : null}
        </div>

        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">Weight</p>
          <div className="flex items-stretch gap-1.5 sm:gap-2">
            <div
              className={cn(
                "flex min-w-0 flex-1 overflow-hidden rounded-md border bg-background",
                weightTooBig ? "border-destructive" : "border-border",
              )}
            >
              <CompactCell
                id={lbId}
                label="Pounds"
                value={weightLb}
                onChange={onWeightLbChange}
                placeholder="0"
                requiredComplete={weightComplete}
              />
            </div>
            <span
              className="flex shrink-0 items-center text-xs font-medium text-muted-foreground sm:text-sm"
              aria-hidden
            >
              +
            </span>
            <div
              className={cn(
                "flex min-w-0 flex-1 overflow-hidden rounded-md border bg-background",
                weightTooBig ? "border-destructive" : "border-border",
              )}
            >
              <CompactCell
                id={ozId}
                label="Ounces"
                value={weightOz}
                onChange={onWeightOzChange}
                placeholder="0"
                requiredComplete={weightComplete}
              />
            </div>
          </div>
          {weightTooBig ? (
            <p className="text-xs font-medium leading-snug text-destructive sm:text-sm" role="alert">
              Weight must be {SURFBOARD_LABEL_MAX_WEIGHT_LB} lb or less.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
