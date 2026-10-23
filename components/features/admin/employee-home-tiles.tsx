import Link from "next/link"
import {
  BellRing,
  ContactRound,
  FolderTree,
  LineChart,
  ShoppingBag,
  Truck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { EMPLOYEE_TOOLS } from "@/lib/admin/employee-access"
import { cn } from "@/lib/utils"

const TILE_TONES = [
  "bg-[hsl(var(--admin-green))]",
  "bg-[hsl(var(--admin-orange))]",
  "bg-[hsl(var(--admin-blue))]",
  "bg-[hsl(var(--admin-purple))]",
] as const

const TILE_ICONS: Record<string, LucideIcon> = {
  "/admin/search-analytics": LineChart,
  "/admin/saved-searches": BellRing,
  "/admin/used-board-market-dashboard?tab=catalog": FolderTree,
  "/admin/crm": ContactRound,
  "/admin/shipping": Truck,
  "/admin/orders/terminal": ShoppingBag,
}

/** Shortcut tiles for the tools an employee can open. Home is the page itself. */
export function EmployeeHomeTiles() {
  const tiles = EMPLOYEE_TOOLS.filter((tool) => tool.href !== "/admin/home")

  return (
    <section>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Your tools
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile, index) => {
          const Icon = TILE_ICONS[tile.href] ?? LineChart
          return (
            <Link
              key={tile.href}
              href={tile.href}
              className={cn(
                "group relative overflow-hidden rounded-xl px-4 py-5 text-white shadow-sm",
                TILE_TONES[index % TILE_TONES.length],
              )}
            >
              <p className="text-lg font-bold tracking-tight">{tile.label}</p>
              <p className="mt-1 text-sm text-white/80">Open</p>
              <Icon className="absolute bottom-3 right-3 h-10 w-10 text-white/20" aria-hidden />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
