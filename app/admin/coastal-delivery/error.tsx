"use client"

export default function CoastalDeliveryError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Could not load coastal delivery.</p>
      <button type="button" onClick={reset} className="text-sm underline">
        Try again
      </button>
    </div>
  )
}
