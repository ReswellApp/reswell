import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FedExMark, UpsMark } from "@/components/features/sell/carrier-mark-icons"

export interface ReswellPackageDimensionsCardProps {
  className?: string
  /** When false, omit the inner title + intro (e.g. parent section already has a heading). */
  showHeading?: boolean
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

function SuffixInput({
  id,
  label,
  suffix,
  value,
  onChange,
  inputMode,
  placeholder,
}: {
  id: string
  label: ReactNode
  suffix: string
  value: string
  onChange: (value: string) => void
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode={inputMode ?? "decimal"}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg pr-10"
        />
        <span
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm tabular-nums text-muted-foreground"
          aria-hidden
        >
          {suffix}
        </span>
      </div>
    </div>
  )
}

export function ReswellPackageDimensionsCard({
  className,
  showHeading = true,
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
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-muted/20 p-5 sm:p-6 space-y-4 shadow-sm",
        className,
      )}
    >
      {showHeading ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Packed size &amp; weight{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            Carriers bill by the box you ship in, not the board specs alone. Underestimating size or
            weight can mean extra charges later — measure the bag or box you&apos;ll actually use.
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-border/80 bg-muted/40 px-3.5 py-3 text-sm leading-relaxed text-foreground/90">
        <div className="flex gap-3">
          <UpsMark className="mt-0.5" />
          <p className="min-w-0">
            <span className="sr-only">UPS. </span>
            Many heavier or longer packed surfboards route{" "}
            <span className="font-semibold text-foreground">UPS</span> Ground.
          </p>
        </div>
        <div className="mt-3 flex gap-3">
          <FedExMark className="mt-0.5" />
          <p className="min-w-0">
            <span className="sr-only">FedEx. </span>
            <span className="font-semibold text-foreground">FedEx</span> often fits mid-size boards,
            faster options, or when it&apos;s the better rate for the lane.
          </p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Reswell picks the rate type at checkout from what you enter here and the buyer&apos;s
          address.
        </p>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Length, width, and height below start from your board dimensions (overall length, width,
        thickness). Add padding for a bag, bubble, or coffin box — adjust as needed.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SuffixInput
          id="reswell-pkg-length-in"
          label={
            <>
              Length{" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </>
          }
          suffix="in"
          value={lengthIn}
          onChange={onLengthInChange}
          placeholder="0"
        />
        <SuffixInput
          id="reswell-pkg-width-in"
          label={
            <>
              Width{" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </>
          }
          suffix="in"
          value={widthIn}
          onChange={onWidthInChange}
          placeholder="0"
        />
        <SuffixInput
          id="reswell-pkg-height-in"
          label={
            <>
              Height{" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </>
          }
          suffix="in"
          value={heightIn}
          onChange={onHeightInChange}
          placeholder="0"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SuffixInput
          id="reswell-pkg-weight-lb"
          label={
            <>
              Weight{" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>{" "}
              (lb)
            </>
          }
          suffix="lb"
          value={weightLb}
          onChange={onWeightLbChange}
          placeholder="0"
        />
        <SuffixInput
          id="reswell-pkg-weight-oz"
          label={
            <>
              Weight{" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>{" "}
              (oz)
            </>
          }
          suffix="oz"
          value={weightOz}
          onChange={onWeightOzChange}
          placeholder="0"
        />
      </div>
    </div>
  )
}
