import Link from "next/link"
import type { GiveawayAdminDashboard } from "@/lib/services/giveawayEntry"
import { GiveawayListingRemindersButton } from "@/components/features/admin/giveaway-listing-reminders-button"
import { Badge } from "@/components/ui/badge"

function formatWhen(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function listingStatusLabel(status: string | null): string {
  if (!status) return "None yet"
  if (status === "sold") return "Sold"
  if (status === "active") return "Live"
  return status
}

export function GiveawayAdminDashboardView({ data }: { data: GiveawayAdminDashboard }) {
  const notListedCount = data.entries.filter((entry) => !entry.listingId).length

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Giveaway button clicks" value={data.ctaClicks} />
        <StatCard label="Signed up from the button" value={data.signupsFromCta} />
        <StatCard label="Qualified (listed a board)" value={data.qualifiedEntries} />
        <StatCard label="Not listed yet" value={notListedCount} />
      </div>

      <section>
        <h2 className="text-sm font-semibold text-foreground">Brand picks</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Clicks on each brand tile, plus how many entered users chose that custom.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Brand</th>
                <th className="px-4 py-2.5 font-medium">Tile clicks</th>
                <th className="px-4 py-2.5 font-medium">Users who want it</th>
              </tr>
            </thead>
            <tbody>
              {data.brandStats.map((row) => (
                <tr key={row.brandId} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium text-foreground">{row.brandName}</td>
                  <td className="px-4 py-2.5 tabular-nums">{row.clicks}</td>
                  <td className="px-4 py-2.5 tabular-nums">{row.entries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Entries</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Listing ID stays even after the board sells or is marked sold — that listing is the raffle
              ticket. Klaviyo sends a confirmation on enter, then a listing reminder if they stay
              pending.
            </p>
          </div>
          <GiveawayListingRemindersButton unlistedCount={notListedCount} />
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Brand</th>
                <th className="px-4 py-2.5 font-medium">Entered</th>
                <th className="px-4 py-2.5 font-medium">Listing ID</th>
                <th className="px-4 py-2.5 font-medium">Listing</th>
                <th className="px-4 py-2.5 font-medium">From CTA</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No entries yet.
                  </td>
                </tr>
              ) : (
                data.entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-border align-top">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-foreground">
                        {entry.displayName || "Surfer"}
                      </p>
                      <p className="text-xs text-muted-foreground">{entry.email || entry.userId}</p>
                    </td>
                    <td className="px-4 py-2.5">{entry.preferredBrandName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {formatWhen(entry.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {entry.listingId ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {entry.listingHref && entry.listingId ? (
                        <Link
                          href={entry.listingHref}
                          className="font-medium text-listingHeart underline-offset-2 hover:underline"
                        >
                          {entry.listingTitle || "View listing"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Not listed yet</span>
                      )}
                      <p className="mt-0.5">
                        <Badge variant="secondary">{listingStatusLabel(entry.listingStatus)}</Badge>
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      {entry.signedUpFromCta ? "Yes" : "No"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
