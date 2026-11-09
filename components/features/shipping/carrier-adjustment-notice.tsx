"use client"

import type { ReactNode } from "react"
import { Camera, Ruler, Scale, ShieldCheck, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface CarrierAdjustmentNoticeProps {
  variant?: "compact" | "prominent"
  className?: string
}

const TIPS = [
  {
    icon: Ruler,
    title: "Measure twice",
    body: "Measure the outside of the fully packed box—not the item by itself. Check length, width, and height.",
  },
  {
    icon: Scale,
    title: "Stay at or below the label",
    body: "Every packed dimension and the final weight must be no greater than what the shipping label allows.",
  },
  {
    icon: Camera,
    title: "Photograph the packed box",
    body: "Before drop-off, take clear photos of the sealed box, its measurements, and the attached label for your records.",
  },
] as const

function AdjustmentDetailsDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[min(92vh,42rem)] max-w-lg overflow-y-auto p-0">
        <DialogHeader className="border-b px-6 pb-5 pt-6 text-left">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <Ruler className="h-5 w-5" aria-hidden />
          </div>
          <DialogTitle>How carrier adjustment fees work</DialogTitle>
          <DialogDescription className="leading-relaxed">
            The label price is based on the package dimensions and weight entered when the label is
            purchased. Carriers measure packages again after drop-off.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 px-6 py-5">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
            <p className="text-sm font-semibold text-foreground">The label measurements are a limit.</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              If the packed box is larger or heavier than the label allows, the carrier may bill an
              adjustment. Any carrier-adjusted amount is deducted from your earnings for that sale.
            </p>
          </div>
          <div className="space-y-3">
            {TIPS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-3 rounded-xl border bg-muted/25 p-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border">
                  <Icon className="h-4 w-4 text-foreground" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            A final measurement before carrier handoff is the best way to avoid unexpected fees.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function CarrierAdjustmentNotice({
  variant = "compact",
  className,
}: CarrierAdjustmentNoticeProps) {
  if (variant === "prominent") {
    return (
      <div
        className={cn(
          "rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 sm:p-5",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-200">
            <TriangleAlert className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Measure the packed box before drop-off
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Keep every side at or below the dimensions on the label. If the carrier measures a
              larger box, its adjustment fee will be deducted from your earnings on this sale.
            </p>
            <AdjustmentDetailsDialog>
              <Button
                type="button"
                variant="link"
                className="mt-2 h-auto p-0 text-sm font-semibold text-foreground"
              >
                See how adjustments work
              </Button>
            </AdjustmentDetailsDialog>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border/80 bg-muted/25 px-3 py-2",
        className,
      )}
    >
      <Ruler className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
      <p className="min-w-0 flex-1 text-xs font-medium text-foreground">Pack to the label—not past it.</p>
      <AdjustmentDetailsDialog>
        <button
          type="button"
          className="shrink-0 text-xs font-semibold text-foreground underline underline-offset-2"
        >
          Why it matters
        </button>
      </AdjustmentDetailsDialog>
    </div>
  )
}
