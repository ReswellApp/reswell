"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/admin/coastal-delivery", label: "Overview" },
  { href: "/admin/coastal-delivery/join", label: "Join" },
  { href: "/admin/coastal-delivery/schedule", label: "Schedule" },
  { href: "/admin/coastal-delivery/stops", label: "Stops" },
  { href: "/admin/coastal-delivery/preview", label: "Listing preview" },
] as const

export function CoastalDeliverySubnav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Coastal delivery">
      {LINKS.map((link) => {
        const active =
          link.href === "/admin/coastal-delivery"
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
