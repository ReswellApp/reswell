import Link from "next/link"
import { redirect } from "next/navigation"
import { SavedSearchesAdminTable } from "@/components/features/admin/saved-searches-admin-table"
import { PEER_LISTING_SECTIONS, PEER_LISTING_SECTION_LABELS } from "@/lib/peer-listing-sections"
import { getAdminSavedSearchesPage } from "@/lib/services/adminSavedSearches"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import type { AdminSavedSearchPage } from "@/lib/types/admin-saved-searches"
import { parseAdminSavedSearchFilters } from "@/lib/utils/admin-saved-search-query"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Saved searches — Admin — Reswell",
  description: "Saved marketplace searches and board alerts, stored in the same table.",
  path: "/admin/saved-searches",
})

function pageHref(page: number, result: Pick<AdminSavedSearchPage, "query" | "kind" | "section">): string {
  const params = new URLSearchParams()
  if (result.query) params.set("q", result.query)
  if (result.kind !== "all") params.set("kind", result.kind)
  if (result.section !== "all") params.set("section", result.section)
  if (page > 1) params.set("page", String(page))
  const search = params.toString()
  return search ? `/admin/saved-searches?${search}` : "/admin/saved-searches"
}

export default async function AdminSavedSearchesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; kind?: string; section?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/admin/saved-searches")
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile?.is_admin) {
    redirect("/admin")
  }

  const filters = parseAdminSavedSearchFilters(await searchParams)
  const result = await getAdminSavedSearchesPage(filters)
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize))
  const from = result.rows.length === 0 ? 0 : (result.page - 1) * result.pageSize + 1
  const to = from === 0 ? 0 : from + result.rows.length - 1
  const accountLabel = result.stats.uniqueAccountsCapped
    ? `${result.stats.uniqueAccounts.toLocaleString("en-US")}+`
    : result.stats.uniqueAccounts.toLocaleString("en-US")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Saved searches</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Board alerts and saved searches live in the same table. A row with email on is a board
          alert; a row with email off is a saved search only.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "All saved", value: result.stats.total },
          { label: "Email alerts", value: result.stats.alerts },
          { label: "Saved only", value: result.stats.savedOnly },
          { label: "Accounts", value: accountLabel },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
              {typeof stat.value === "number" ? stat.value.toLocaleString("en-US") : stat.value}
            </p>
          </div>
        ))}
      </div>

      <form action="/admin/saved-searches" className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <input
          type="search"
          name="q"
          defaultValue={result.query}
          aria-label="Search account, label, brand, or model"
          placeholder="Account, label, brand, or model"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring lg:max-w-sm"
        />
        <select
          name="kind"
          defaultValue={result.kind}
          aria-label="Email alert filter"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
        >
          <option value="all">Alerts and saved</option>
          <option value="alerts">Email alerts</option>
          <option value="saved">Saved only</option>
        </select>
        <select
          name="section"
          defaultValue={result.section}
          aria-label="Section filter"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
        >
          <option value="all">All sections</option>
          <option value="any">Any section</option>
          {PEER_LISTING_SECTIONS.map((section) => (
            <option key={section} value={section}>
              {PEER_LISTING_SECTION_LABELS[section]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background"
        >
          Filter
        </button>
      </form>

      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {result.total.toLocaleString("en-US")}
        {result.query ? ` for “${result.query}”` : ""}.
        {result.userMatchTruncated ? " Account matches were limited to the first 200." : ""}
      </p>

      <SavedSearchesAdminTable rows={result.rows} />

      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm">
          {result.page > 1 ? (
            <Link href={pageHref(result.page - 1, result)} className="hover:underline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Page {result.page} of {pageCount}
          </span>
          {result.page < pageCount ? (
            <Link href={pageHref(result.page + 1, result)} className="hover:underline">
              Next
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  )
}
