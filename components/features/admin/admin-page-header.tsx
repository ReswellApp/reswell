import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AdminBreadcrumb {
  label: string
  href?: string
}

interface AdminPageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: AdminBreadcrumb[]
  actions?: ReactNode
  className?: string
}

export function AdminPageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: AdminPageHeaderProps) {
  return (
    <header className={cn('space-y-4', className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Home className="h-3.5 w-3.5" aria-hidden />
          {breadcrumbs.map((crumb, index) => {
            const last = index === breadcrumbs.length - 1
            return (
              <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3" aria-hidden />
                {crumb.href && !last ? (
                  <Link href={crumb.href} className="hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={last ? 'font-medium text-[hsl(var(--admin-teal))]' : undefined}>
                    {crumb.label}
                  </span>
                )}
              </span>
            )
          })}
        </nav>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-headline text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
            {title}
          </h1>
          {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
