import { Hourglass } from "lucide-react"

import { listingScarcityCopy } from "@/lib/listing-quantity"
import { cn } from "@/lib/utils"

interface ListingScarcityLineProps {
  condition: string | null | undefined
  quantity: unknown
  className?: string
  /** Extra clause, such as how many people have the listing in a cart. */
  extraDetail?: string | null
}

export function ListingScarcityLine({
  condition,
  quantity,
  className,
  extraDetail = null,
}: ListingScarcityLineProps) {
  const copy = listingScarcityCopy(condition, quantity)
  if (!copy) return null

  return (
    <p className={cn("flex items-start gap-2 text-[15px] text-foreground", className)}>
      <Hourglass className="mt-0.5 h-[15px] w-[15px] shrink-0 text-muted-foreground" aria-hidden />
      <span>
        <span className="font-semibold">{copy.title}</span>
        <span className="text-muted-foreground"> {copy.detail}</span>
        {extraDetail ? <span className="text-muted-foreground"> {extraDetail}</span> : null}
      </span>
    </p>
  )
}
