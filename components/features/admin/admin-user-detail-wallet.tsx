import { Loader2, RefreshCw, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatAdminUsd } from '@/lib/admin/admin-user-detail-display'

export interface AdminUserWalletSummary {
  balance: number
  pendingBalance: number
  totalBalance: number
  lifetime_earned: number
  lifetime_spent: number
  lifetime_cashed_out: number
  walletId: string | null
}

interface AdminUserDetailWalletProps {
  loading: boolean
  error: string | null
  summary: AdminUserWalletSummary | null
  resetting: boolean
  onReset: () => void
}

export function AdminUserDetailWallet({
  loading,
  error,
  summary,
  resetting,
  onReset,
}: AdminUserDetailWalletProps) {
  return (
    <section className="admin-surface p-5">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="font-headline text-sm font-semibold text-foreground">Wallet</h2>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading wallet…
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      ) : summary ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatAdminUsd(summary.totalBalance)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatAdminUsd(summary.balance)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatAdminUsd(summary.pendingBalance)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Lifetime earned {formatAdminUsd(summary.lifetime_earned)} · spent{' '}
            {formatAdminUsd(summary.lifetime_spent)} · cashed out {formatAdminUsd(summary.lifetime_cashed_out)}
          </p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="gap-2"
            disabled={resetting}
            onClick={onReset}
          >
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Reset earnings to $0.00
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No wallet data.</p>
      )}
    </section>
  )
}
