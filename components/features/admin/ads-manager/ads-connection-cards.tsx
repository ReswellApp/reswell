import type { AdsAccountSnapshot } from "@/lib/types/adsManager"
import { platformLabel } from "@/components/features/admin/ads-manager/ads-manager-ui"

export function AdsConnectionCards({ accounts }: { accounts: AdsAccountSnapshot[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {accounts.map((account) => (
        <article key={account.platform} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">{platformLabel(account.platform)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {account.configured
                  ? account.accountName || account.accountId || "Connected"
                  : "Not connected"}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {account.currency || (account.configured ? "" : "Setup")}
            </span>
          </div>
          {account.accountId ? (
            <p className="mt-2 font-mono text-xs text-muted-foreground">{account.accountId}</p>
          ) : null}
          {account.error ? <p className="mt-3 text-sm text-destructive">{account.error}</p> : null}
          {account.missing.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {account.missing.map((item) => (
                <li key={item} className="font-mono">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
          {account.truncated ? (
            <p className="mt-3 text-xs text-muted-foreground">Showing the first 400 objects in this account.</p>
          ) : null}
        </article>
      ))}
    </div>
  )
}
