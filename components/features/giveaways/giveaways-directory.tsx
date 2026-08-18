import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { resolveGiveawayStatus } from "@/lib/giveaways/catalog"
import { giveawayDetailHref } from "@/lib/giveaways/paths"
import type { Giveaway } from "@/lib/types/giveaways"
import { Badge } from "@/components/ui/badge"

type GiveawaysDirectoryProps = {
  giveaways: Giveaway[]
}

function statusLabel(giveaway: Giveaway): string {
  const status = resolveGiveawayStatus(giveaway)
  if (status === "upcoming") return "Coming soon"
  if (status === "ended") return "Ended"
  return "Open now"
}

export function GiveawaysDirectory({ giveaways }: GiveawaysDirectoryProps) {
  if (giveaways.length === 0) {
    return (
      <section className="container mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Sparkles className="h-7 w-7 text-muted-foreground" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold text-foreground">No giveaways right now</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Check back soon — we run raffles for sellers who list on Reswell.
        </p>
      </section>
    )
  }

  return (
    <section className="mt-4">
      <ul className="space-y-4">
        {giveaways.map((giveaway) => {
          return (
            <li key={giveaway.slug}>
              <Link
                href={giveawayDetailHref(giveaway.slug)}
                className="block rounded-2xl border border-foreground/15 bg-white p-6 transition-colors hover:bg-neutral-50/80"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{statusLabel(giveaway)}</Badge>
                  <p className="text-xs text-muted-foreground">{giveaway.scheduleLabel}</p>
                </div>
                <h2 className="mt-3 text-xl font-bold tracking-tight text-foreground">
                  {giveaway.title}
                </h2>
                <p className="mt-2 text-pretty text-sm text-muted-foreground sm:text-base">
                  {giveaway.summary}
                </p>
                <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                  Learn more
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
