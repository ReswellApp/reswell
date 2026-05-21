import Link from "next/link"
import type { HelpCenterBreadcrumb } from "@/lib/help-center/types"

export function HelpCenterBreadcrumbs({ items }: { items: HelpCenterBreadcrumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <span aria-hidden className="text-neutral-400">{">"}</span> : null}
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-neutral-900 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "text-neutral-500" : undefined}>{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
