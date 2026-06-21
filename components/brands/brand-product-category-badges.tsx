import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import { brandProductCategoryLabel } from "@/lib/brand-product-categories"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type BrandProductCategoryBadgesProps = {
  categories: readonly BrandProductCategorySlug[]
  className?: string
  /** Smaller pills for dense cards. */
  size?: "sm" | "default"
}

export function BrandProductCategoryBadges({
  categories,
  className,
  size = "default",
}: BrandProductCategoryBadgesProps) {
  if (categories.length === 0) return null

  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {categories.map((slug) => (
        <li key={slug}>
          <Badge
            variant="secondary"
            className={cn(
              "font-medium",
              size === "sm" && "px-2 py-0 text-[10px] leading-4",
            )}
          >
            {brandProductCategoryLabel(slug)}
          </Badge>
        </li>
      ))}
    </ul>
  )
}
