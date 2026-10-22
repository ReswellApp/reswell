import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { shipEngineDisputeLinkForShipment } from "@/lib/shipping/shipengine-dispute-link"
import { cn } from "@/lib/utils"

interface AdminOrderShipEngineDisputeLinkProps {
  trackingCarrier: string | null
  trackingNumber: string | null
  className?: string
}

export function AdminOrderShipEngineDisputeLink({
  trackingCarrier,
  trackingNumber,
  className,
}: AdminOrderShipEngineDisputeLinkProps) {
  const link = shipEngineDisputeLinkForShipment({ trackingCarrier, trackingNumber })
  const tracking = trackingNumber?.trim() || null

  return (
    <div className={cn("space-y-2 rounded-lg border border-border/60 bg-muted/20 p-4", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Shipping dispute
      </p>
      <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5 bg-background" asChild>
        <a href={link.href} target="_blank" rel="noreferrer">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          {link.label}
        </a>
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">{link.hint}</p>
      {tracking ? (
        <p className="break-all font-mono text-xs text-foreground">{tracking}</p>
      ) : null}
    </div>
  )
}
