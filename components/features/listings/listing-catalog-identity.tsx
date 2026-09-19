import type { ReactNode } from "react"
import Link from "next/link"
import { isShippingFulfillmentLabel } from "@/lib/listing-fulfillment"
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
        className="font-semibold text-foreground underline-offset-4 hover:underline"
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

export function ListingFulfillmentSubline({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      {labels.map((label, index) => (
        <span key={label} className="inline-flex items-baseline gap-x-1.5">
          {index > 0 ? <MetaDot /> : null}
          <span
            className={
              isShippingFulfillmentLabel(label)
                ? "font-medium text-[#4263eb]"
                : "text-muted-foreground"
            }
          >
            {label}
          </span>
        </span>
      ))}
    </span>
  )
}

export function ListingCatalogIdentity({
  brandName,
  brandHref,
  modelName,
  modelHref,
  condition,
  detail,
  className,
}: {
  brandName: string | null
  brandHref?: string | null
  modelName?: string | null
  modelHref?: string | null
  condition?: string | null
  detail?: ReactNode
  className?: string
}) {
  const brand = brandName?.trim() || null
  const model = modelName?.trim() || null
  const conditionLabel = condition?.trim() || null
  const hasDetail = Boolean(detail)
  if (!brand && !model && !conditionLabel && !hasDetail) return null

  return (
    <div className={cn("min-w-0", className)}>
      {brand || model || conditionLabel ? (
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
          {conditionLabel ? (
            <>
              {brand || model ? <MetaDot /> : null}
              <span className="text-[13px] font-normal text-muted-foreground">
                Used – {conditionLabel}
              </span>
            </>
          ) : null}
        </nav>
      ) : null}
      {hasDetail ? (
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  )
}
