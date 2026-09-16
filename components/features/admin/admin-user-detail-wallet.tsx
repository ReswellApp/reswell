import { Loader2, Plus, RefreshCw, Wallet } from 'lucide-react'
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
  onAddCredit: () => void
}

function AddCreditButton({ onAddCredit }: { onAddCredit: () => void }) {
  return (
    <Button type="button" size="sm" className="gap-2" onClick={onAddCredit}>
      <Plus className="h-4 w-4" />
      Add credit
    </Button>
  )
}

export function AdminUserDetailWallet({
  loading,
  error,
  summary,
  resetting,
  onReset,
  onAddCredit,
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
        <div className="mt-4 space-y-4">
          <p className="text-sm text-destructive">{error}</p>
          <AddCreditButton onAddCredit={onAddCredit} />
        </div>
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
          <div className="flex flex-wrap gap-2">
            <AddCreditButton onAddCredit={onAddCredit} />
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
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">No wallet data.</p>
          <AddCreditButton onAddCredit={onAddCredit} />
        </div>
      )}
    </section>
  )
}
