"use client"

import { useId, useRef, useState } from "react"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { compressImageForBoardDimScan } from "@/lib/client/compress-image-for-board-dim-scan"
import type { ScanBoardDimsNormalized } from "@/lib/validations/scan-board-dims"
import { cn } from "@/lib/utils"

export type ScanBoardDimsApplyPayload = {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
}

type ScanBoardDimsControlProps = {
  disabled?: boolean
  onApply: (dims: ScanBoardDimsApplyPayload) => void
  className?: string
}

function formatPreviewLine(data: ScanBoardDimsNormalized): string {
  const parts: string[] = []
  if (data.boardLength) parts.push(data.boardLength)
  if (data.boardWidthInches) parts.push(`${data.boardWidthInches}"`)
  if (data.boardThicknessInches) parts.push(`${data.boardThicknessInches}"`)
  if (data.boardVolumeL) parts.push(`${data.boardVolumeL}L`)
  return parts.join(" · ")
}

export function ScanBoardDimsControl({
  disabled,
  onApply,
  className,
}: ScanBoardDimsControlProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState<ScanBoardDimsNormalized | null>(null)

  async function runScan(file: File) {
    setScanning(true)
    try {
      const compressed = await compressImageForBoardDimScan(file)
      const res = await fetch("/api/sell/scan-board-dims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: compressed.base64,
          mediaType: compressed.mediaType,
        }),
      })

      let body: unknown = null
      try {
        body = await res.json()
      } catch {
        body = null
      }

      const errorMessage =
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof (body as { error: unknown }).error === "string"
          ? (body as { error: string }).error
          : null

      if (!res.ok) {
        toast.error(
          errorMessage ??
            "Couldn’t read the sticker. Try a sharper close-up, or enter dimensions manually.",
        )
        return
      }

      const data =
        body &&
        typeof body === "object" &&
        "data" in body &&
        (body as { data: unknown }).data &&
        typeof (body as { data: unknown }).data === "object"
          ? ((body as { data: ScanBoardDimsNormalized }).data)
          : null

      if (!data || typeof data.fieldCount !== "number" || data.fieldCount < 1) {
        toast.error(
          "Couldn’t find clear length, width, thickness, or volume. Fill them in manually.",
        )
        return
      }

      setPending(data)
      setConfirmOpen(true)
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn’t read the sticker. Enter dimensions manually.",
      )
    } finally {
      setScanning(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function handleApply() {
    if (!pending) return
    onApply({
      boardLength: pending.boardLength ?? "",
      boardWidthInches: pending.boardWidthInches ?? "",
      boardThicknessInches: pending.boardThicknessInches ?? "",
      boardVolumeL: pending.boardVolumeL ?? "",
    })
    setConfirmOpen(false)
    setPending(null)
    toast.success("Dimensions filled — double-check before publishing.")
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={disabled || scanning}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void runScan(file)
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || scanning}
        className="h-9 gap-1.5 border-slate-300 bg-card shadow-sm"
        onClick={() => inputRef.current?.click()}
      >
        {scanning ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Camera className="h-4 w-4 text-listingHeart" aria-hidden />
        )}
        {scanning ? "Reading sticker…" : "Scan sticker"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Point at the dims label — we’ll suggest L / W / T / Vol.
      </p>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open)
          if (!open) setPending(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply scanned dimensions?</DialogTitle>
            <DialogDescription>
              We read these from your sticker photo. Confirm they look right before filling the
              form — you can still edit after.
            </DialogDescription>
          </DialogHeader>

          {pending ? (
            <div className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3">
              <p className="text-base font-semibold tracking-tight text-foreground tabular-nums">
                {formatPreviewLine(pending)}
              </p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                <li>
                  Length:{" "}
                  <span className="font-medium text-foreground">
                    {pending.boardLength ?? "—"}
                  </span>
                </li>
                <li>
                  Width:{" "}
                  <span className="font-medium text-foreground">
                    {pending.boardWidthInches ? `${pending.boardWidthInches} in` : "—"}
                  </span>
                </li>
                <li>
                  Thickness:{" "}
                  <span className="font-medium text-foreground">
                    {pending.boardThicknessInches
                      ? `${pending.boardThicknessInches} in`
                      : "—"}
                  </span>
                </li>
                <li>
                  Volume:{" "}
                  <span className="font-medium text-foreground">
                    {pending.boardVolumeL ? `${pending.boardVolumeL} L` : "—"}
                  </span>
                </li>
              </ul>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmOpen(false)
                setPending(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleApply} disabled={!pending}>
              Apply to form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
