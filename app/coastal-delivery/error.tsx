"use client"

export default function CoastalDeliveryShipperError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-3 p-6">
      <p className="text-sm text-muted-foreground">Could not load this coastal run.</p>
      <button type="button" onClick={reset} className="text-sm underline">
        Try again
      </button>
    </div>
  )
}
