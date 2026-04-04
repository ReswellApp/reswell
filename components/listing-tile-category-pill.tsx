import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/** Small outline pill for marketplace category (or board type fallback) on listing tiles. */
export function ListingTileCategoryPill({
  label,
  className,
}: {
  label: string | null | undefined
  className?: string
}) {
  const t = typeof label === "string" ? label.trim() : ""
  if (!t) return null
  return (
    <Badge variant="outline" className={cn("shrink-0 text-[10px] px-1.5 py-0 font-normal", className)}>
      {t}
    </Badge>
  )
}
