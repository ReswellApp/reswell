"use client"

import Link from "next/link"
import {
  Bell,
  ExternalLink,
  KeyRound,
  MapPin,
  Plus,
  Store,
  Tag,
  Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ListingsAdvancedToolsProps {
  sellerStoreHref: string | null
  sellerBanned: boolean
}

const TOOLS: {
  href: string
  label: string
  detail: string
  icon: typeof Store
  external?: boolean
}[] = [
  {
    href: "/dashboard/profile",
    label: "Shop profile",
    detail: "Name, photo, bio",
    icon: Store,
  },
  {
    href: "/dashboard/profile#addresses",
    label: "Addresses",
    detail: "Ship-from locations",
    icon: MapPin,
  },
  {
    href: "/dashboard/profile#notifications",
    label: "Notifications",
    detail: "Email and texts",
    icon: Bell,
  },
  {
    href: "/dashboard/profile#sign-in",
    label: "Sign-in",
    detail: "Email and password",
    icon: KeyRound,
  },
  {
    href: "/dashboard/offers",
    label: "Offers",
    detail: "Buyer offers",
    icon: Tag,
  },
  {
    href: "/dashboard/earnings",
    label: "Earnings",
    detail: "Payouts and balance",
    icon: Wallet,
  },
]

export function ListingsAdvancedTools({ sellerStoreHref, sellerBanned }: ListingsAdvancedToolsProps) {
  return (
    <section className="space-y-3" aria-labelledby="listings-tools-heading">
      <div>
        <h2 id="listings-tools-heading" className="text-base font-semibold text-foreground">
          Quick tools
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Jump to the profile settings that change how your shop shows up.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-3 py-3 shadow-sm transition-colors hover:bg-muted/60"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <tool.icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{tool.label}</span>
              <span className="block truncate text-[12px] text-muted-foreground">{tool.detail}</span>
            </span>
          </Link>
        ))}
        {sellerStoreHref ? (
          <Link
            href={sellerStoreHref}
            className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-3 py-3 shadow-sm transition-colors hover:bg-muted/60"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <ExternalLink className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">View shop</span>
              <span className="block truncate text-[12px] text-muted-foreground">Public seller page</span>
            </span>
          </Link>
        ) : null}
        {!sellerBanned ? (
          <Link
            href="/sell?new=1"
            className={cn(
              "flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-3 shadow-sm transition-colors hover:bg-primary/10",
            )}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Plus className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">New listing</span>
              <span className="block truncate text-[12px] text-muted-foreground">Start a draft</span>
            </span>
          </Link>
        ) : null}
      </div>
    </section>
  )
}
