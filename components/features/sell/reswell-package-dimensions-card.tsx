import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FedExMark, UpsMark } from "@/components/features/sell/carrier-mark-icons"

export interface ReswellPackageDimensionsCardProps {
  className?: string
  /** When false, omit the inner title + intro (e.g. parent section already has a heading). */
  showHeading?: boolean
  /**
   * Admin exact carton mode: hide board-sync copy and state that quotes use the entered
   * outer box with no packing pad / buffer added.
   */
  exactCartonMode?: boolean
  /** Outer packed length placeholder (surfboards use feet/inches; fins use inches). */
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
  const hasSuffix = suffix.trim() !== ""
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
          className={cn(
            "h-11 rounded-lg border-foreground/20 bg-card shadow-sm placeholder:text-muted-foreground",
            hasSuffix ? "pr-10" : "pr-4",
          )}
        />
        {hasSuffix ? (
          <span
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm tabular-nums text-muted-foreground"
            aria-hidden
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function ReswellPackageDimensionsCard({
  className,
  showHeading = true,
  exactCartonMode = false,
  lengthPlaceholder = "e.g. 6'1",
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
        "space-y-4 rounded-xl border border-slate-300 bg-card p-5 shadow-md ring-1 ring-slate-900/[0.05] sm:p-6",
        className,
      )}
    >
      {showHeading ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Packed size &amp; weight
          </h3>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {exactCartonMode
              ? "Enter the exact outer box you will ship in. Quotes and labels use these numbers as-is — no packing pad or buffer is added."
              : "Carriers bill by the box you ship in, not the board specs alone. Underestimating size or weight can mean extra charges later — measure the bag or box you will actually use."}
          </p>
        </div>
      ) : null}

      {!exactCartonMode ? (
        <div className="rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-foreground/90">
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
            address. UPS Ground limit: Length + (2 × Width) + (2 × Height) must be 160″ or less
            (165″ carrier max minus 5″ measurement buffer); weight 25 lb or less.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground leading-relaxed">
          Quotes use your exact outer L×W×H and weight — no packing pad. UPS Ground limit: Length +
          (2 × Width) + (2 × Height) ≤ 160″, weight ≤ 25 lb.
        </p>
      )}

      {!exactCartonMode ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            When Reswell shipping is on, these three fields stay in sync with{" "}
            <span className="font-medium text-foreground/80">Length</span>,{" "}
            <span className="font-medium text-foreground/80">Width</span>, and{" "}
            <span className="font-medium text-foreground/80">Thickness</span> above — change them here
            only if your packed box differs. Length uses the same feet-and-inches style (such as
            5&apos;4), or outer inches. Width and height use the same inch values — we use what you
            save for carrier rates.
          </p>
        </div>
      ) : null}

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
          suffix=""
          value={lengthIn}
          onChange={onLengthInChange}
          inputMode="text"
          placeholder={lengthPlaceholder}
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
              Weight (lb){" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
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
              Weight (oz){" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
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
