"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PendingIntakeListItem } from "@/lib/db/consignmentStores"

interface IntakeApprovalListProps {
  intakes: PendingIntakeListItem[]
  defaultCommissionBps: number
}

const CONDITION_LABELS: Record<string, string> = {
  brand_new: "Brand new",
  excellent: "Excellent",
  very_good: "Very good",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
}

export function IntakeApprovalList({ intakes, defaultCommissionBps }: IntakeApprovalListProps) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [askingPrices, setAskingPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      intakes.map((i) => [i.intakeId, i.consignorProposedPrice?.toString() ?? ""]),
    ),
  )
  const [commissionPct, setCommissionPct] = useState<Record<string, string>>(() =>
    Object.fromEntries(intakes.map((i) => [i.intakeId, (defaultCommissionBps / 100).toString()])),
  )

  if (intakes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No boards waiting for approval. New consignments will appear here.
      </div>
    )
  }

  async function handleApprove(intake: PendingIntakeListItem) {
    const asking = parseFloat(askingPrices[intake.intakeId] ?? "")
    const pct = parseFloat(commissionPct[intake.intakeId] ?? "")
    if (!Number.isFinite(asking) || asking <= 0) {
      toast.error("Enter a valid asking price.")
      return
    }
    if (intake.floorPrice != null && asking < intake.floorPrice) {
      toast.error(`Asking price can't be below the consignor's floor ($${intake.floorPrice}).`)
      return
    }
    if (!Number.isFinite(pct) || pct < 7 || pct > 90) {
      toast.error("Commission must be between 7% and 90%.")
      return
    }

    setBusyId(intake.intakeId)
    try {
      const res = await fetch("/api/consignment/intake/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intakeId: intake.intakeId,
          askingPrice: asking,
          commissionBps: Math.round(pct * 100),
        }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(json?.error ?? "Couldn't approve. Try again.")
        return
      }
      toast.success("Board approved and live.")
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(intake: PendingIntakeListItem) {
    setBusyId(intake.intakeId)
    try {
      const res = await fetch("/api/consignment/intake/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intakeId: intake.intakeId }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(json?.error ?? "Couldn't reject. Try again.")
        return
      }
      toast.success("Intake rejected.")
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {intakes.map((intake) => {
        const busy = busyId === intake.intakeId
        return (
          <div
            key={intake.intakeId}
            className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row"
          >
            <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-md bg-muted sm:h-28 sm:w-28">
              {intake.coverUrl ? (
                <Image
                  src={intake.coverUrl}
                  alt={intake.title}
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  No photo
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-medium leading-tight">{intake.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[
                    intake.boardType,
                    intake.condition ? CONDITION_LABELS[intake.condition] ?? intake.condition : null,
                    intake.dimensions,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No details"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Proposed ${intake.consignorProposedPrice ?? "—"} · Floor $
                  {intake.floorPrice ?? "—"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`asking-${intake.intakeId}`} className="text-xs">
                    Asking price
                  </Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      id={`asking-${intake.intakeId}`}
                      type="number"
                      min="1"
                      step="1"
                      value={askingPrices[intake.intakeId] ?? ""}
                      onChange={(e) =>
                        setAskingPrices((prev) => ({ ...prev, [intake.intakeId]: e.target.value }))
                      }
                      className="h-9 pl-6"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`commission-${intake.intakeId}`} className="text-xs">
                    Shop commission
                  </Label>
                  <div className="relative">
                    <Input
                      id={`commission-${intake.intakeId}`}
                      type="number"
                      min="7"
                      max="90"
                      step="1"
                      value={commissionPct[intake.intakeId] ?? ""}
                      onChange={(e) =>
                        setCommissionPct((prev) => ({ ...prev, [intake.intakeId]: e.target.value }))
                      }
                      className="h-9 pr-7"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleApprove(intake)}
                  disabled={busy}
                  className="flex-1"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve & list"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReject(intake)}
                  disabled={busy}
                >
                  Reject
                </Button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
