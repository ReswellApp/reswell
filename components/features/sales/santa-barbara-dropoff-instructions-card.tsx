import { MapPin, MessageSquareText, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function SantaBarbaraDropoffInstructionsCard({
  addressLine1,
  city,
  state,
  postalCode,
  phoneDisplay,
  phoneE164,
  className,
}: {
  addressLine1: string
  city: string
  state: string
  postalCode: string
  phoneDisplay: string
  phoneE164: string
  className?: string
}) {
  return (
    <Card className={cn("border-primary/30 bg-primary/[0.04]", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5 text-primary" />
          Santa Barbara drop-off — no label needed
        </CardTitle>
        <CardDescription className="leading-relaxed">
          You selected Santa Barbara drop-off for this board. Do not buy, create, or print a
          shipping label. Reswell will pack the board and create the carrier label after you hand
          it off.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground">
          <li>
            Call or text before you leave to coordinate a drop-off time and confirm someone is
            available.
          </li>
          <li>
            Bring the unpacked surfboard and any fins or accessories included in the sale to:
            <address className="mt-2 not-italic font-medium">
              Reswell
              <br />
              {addressLine1}
              <br />
              {city}, {state} {postalCode}
            </address>
          </li>
          <li>Leave the board with Reswell. We will pack it, label it, and ship it to the buyer.</li>
        </ol>

        <div className="flex flex-wrap gap-2">
          <Button asChild className="gap-2">
            <a href={`tel:${phoneE164}`}>
              <Phone className="h-4 w-4" />
              Call {phoneDisplay}
            </a>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <a href={`sms:${phoneE164}`}>
              <MessageSquareText className="h-4 w-4" />
              Text {phoneDisplay}
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
