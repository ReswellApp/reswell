import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

function IdentityLink({
  name,
  href,
  kind,
}: {
  name: string
  href: string | null
  kind: "brand" | "model"
}) {
  if (href) {
    return (
      <Link
        href={href}
        className="font-semibold text-foreground underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground"
        aria-label={`View ${name} ${kind} page`}
      >
        {name}
      </Link>
    )
  }

  return <span className="font-semibold text-foreground">{name}</span>
}

function MetaDot() {
  return (
    <span className="text-neutral-300 dark:text-neutral-600" aria-hidden>
      ·
    </span>
  )
}

export function ListingCatalogIdentity({
  brandName,
  brandHref,
  modelName,
  modelHref,
  detail,
  className,
}: {
  brandName: string | null
  brandHref?: string | null
  modelName?: string | null
  modelHref?: string | null
  detail?: ReactNode
  className?: string
}) {
  const brand = brandName?.trim() || null
  const model = modelName?.trim() || null
  const hasDetail = Boolean(detail)
  if (!brand && !model && !hasDetail) return null

  return (
    <div className={cn("min-w-0", className)}>
      {brand || model ? (
        <nav
          aria-label="Brand and model"
          className="flex flex-wrap items-baseline gap-x-2 text-[15px] leading-snug"
        >
          {brand ? (
            <IdentityLink name={brand} href={brandHref?.trim() || null} kind="brand" />
          ) : null}
          {brand && model ? <MetaDot /> : null}
          {model ? (
            <IdentityLink name={model} href={modelHref?.trim() || null} kind="model" />
          ) : null}
        </nav>
      ) : null}
      {hasDetail ? (
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  )
}
