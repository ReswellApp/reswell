import Link from "next/link"
import { priceGuideHubHref } from "@/lib/price-guide/categories"

type Crumb = { label: string; href?: string }

export function PriceGuideBreadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href={priceGuideHubHref()} className="hover:text-foreground">
            Price Guide
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.label} className="flex items-center gap-1.5">
            <span aria-hidden>/</span>
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-foreground">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-foreground">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
