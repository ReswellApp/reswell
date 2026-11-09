import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import type { AdminSavedSearchRow } from "@/lib/types/admin-saved-searches"

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  })
}

function accountLabel(row: AdminSavedSearchRow): string {
  return row.account.displayName || row.account.email || "Unknown account"
}

export function SavedSearchesAdminTable({ rows }: { rows: AdminSavedSearchRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No saved searches match these filters.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[960px] text-left text-sm">
        <caption className="sr-only">Saved searches and board alerts</caption>
        <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Account</th>
            <th className="px-3 py-2 font-medium">Saved search</th>
            <th className="px-3 py-2 font-medium">Section</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Emails sent</th>
            <th className="px-3 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border align-top last:border-0">
              <td className="px-3 py-3">
                <Link href={`/admin/users/${row.account.id}`} className="font-medium hover:underline">
                  {accountLabel(row)}
                </Link>
                {row.account.email && row.account.displayName ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{row.account.email}</p>
                ) : null}
              </td>
              <td className="px-3 py-3">
                <p className="font-medium">{row.label || row.summary}</p>
                {row.label ? <p className="mt-0.5 text-muted-foreground">{row.summary}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">{row.sourceLabel}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <Link href={row.browseHref} className="hover:underline">
                    Open search
                  </Link>
                  <details>
                    <summary className="cursor-pointer text-muted-foreground">Criteria</summary>
                    <pre className="mt-2 max-w-md overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-2 text-[11px] leading-relaxed text-foreground">
                      {row.criteriaJson}
                    </pre>
                  </details>
                </div>
              </td>
              <td className="px-3 py-3">{row.sectionLabel}</td>
              <td className="px-3 py-3">{row.alertKindLabel}</td>
              <td className="px-3 py-3">
                <Badge variant={row.emailEnabled ? "default" : "secondary"}>
                  {row.emailEnabled ? "Alert on" : "Saved only"}
                </Badge>
              </td>
              <td className="px-3 py-3 tabular-nums">{row.alertsSent}</td>
              <td className="px-3 py-3 text-muted-foreground">
                <p>{formatWhen(row.updatedAt)}</p>
                <p className="mt-0.5 text-xs">Saved {formatWhen(row.createdAt)}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
