import Link from "next/link"
import { format } from "date-fns"
import { Mail, MapPin, Phone, UserRound } from "lucide-react"
import type { SupportCaseCustomerContext } from "@/lib/services/supportCaseCustomerContext"
import { formatCustomerUsd } from "@/lib/admin/case-customer-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface CaseCustomerIdentityProps {
  context: SupportCaseCustomerContext
}

export function CaseCustomerIdentity({ context }: CaseCustomerIdentityProps) {
  const profile = context.profile

  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {profile ? (
              <Link href={`/admin/users/${profile.id}`} className="truncate text-sm font-semibold hover:underline">
                {profile.displayName}
              </Link>
            ) : (
              <p className="truncate text-sm font-semibold">Guest</p>
            )}
            {context.flags.map((flag) => (
              <Badge key={flag.id} variant={flag.tone} className="h-5 text-[9px]">
                {flag.label}
              </Badge>
            ))}
          </div>
          <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
            {profile?.email ? (
              <p className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                <a href={`mailto:${profile.email}`} className="truncate hover:underline">
                  {profile.email}
                </a>
              </p>
            ) : null}
            {profile?.phone ? (
              <p className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {profile.phone}
              </p>
            ) : null}
            {profile?.location ? (
              <p className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {profile.location}
              </p>
            ) : null}
            {profile ? (
              <p>Member since {format(new Date(profile.createdAt), "MMM yyyy")}</p>
            ) : (
              <p>No Reswell account matched this email.</p>
            )}
          </div>
          {profile ? (
            <Button variant="ghost" size="sm" className="mt-1.5 h-7 px-2 text-[11px]" asChild>
              <Link href={`/admin/users/${profile.id}`}>View complete profile</Link>
            </Button>
          ) : null}
        </div>
      </div>
      {profile ? (
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/50 pt-3 text-center">
          <div>
            <p className="text-sm font-semibold">{context.commerce.purchases}</p>
            <p className="text-[10px] text-muted-foreground">
              Purchases
              {context.commerce.purchaseSpend != null
                ? ` · ${formatCustomerUsd(context.commerce.purchaseSpend)}`
                : ""}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">{context.commerce.sales}</p>
            <p className="text-[10px] text-muted-foreground">
              Sales
              {context.commerce.salesVolume != null
                ? ` · ${formatCustomerUsd(context.commerce.salesVolume)}`
                : ""}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">{context.commerce.activeListings}</p>
            <p className="text-[10px] text-muted-foreground">Active listings</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
