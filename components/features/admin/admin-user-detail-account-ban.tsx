import { Ban, Loader2, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AdminStatusPill } from '@/components/features/admin/admin-status-pill'

export interface AdminAccountBanState {
  banned: boolean
  bannedUntil: string | null
  reason: string | null
}

interface AccountBanProps {
  loading: boolean
  saving: boolean
  isAdminUser: boolean
  ban: AdminAccountBanState | null
  reason: string
  onReasonChange: (value: string) => void
  onApply: (banned: boolean) => void
}

export function AdminUserDetailAccountBan({
  loading,
  saving,
  isAdminUser,
  ban,
  reason,
  onReasonChange,
  onApply,
}: AccountBanProps) {
  return (
    <section className="admin-surface p-5">
      <div className="flex items-center gap-2">
        <Ban className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="font-headline text-sm font-semibold text-foreground">Permanent ban</h2>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading ban status…
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {ban?.banned ? (
              <AdminStatusPill label="Permanently banned" tone="red" />
            ) : (
              <AdminStatusPill label="Can use Reswell" tone="green" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Permanently banned users cannot sign in with email or Google. They cannot buy, sell,
            message, leave reviews, or use Reswell in any way. Live listings move to delinquent.
          </p>
          {!ban?.banned ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="account-ban-reason">Internal note (optional)</Label>
                <Input
                  id="account-ban-reason"
                  value={reason}
                  onChange={(event) => onReasonChange(event.target.value)}
                  placeholder="Reason for permanent ban"
                  maxLength={500}
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-2"
                disabled={saving || isAdminUser}
                onClick={() => onApply(true)}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                Ban account
              </Button>
              {isAdminUser ? (
                <p className="text-xs text-muted-foreground">
                  Admin accounts cannot be banned from this screen.
                </p>
              ) : null}
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" className="gap-2" disabled={saving} onClick={() => onApply(false)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
              Remove ban
            </Button>
          )}
          {ban?.reason ? <p className="text-xs text-muted-foreground">Note: {ban.reason}</p> : null}
        </div>
      )}
    </section>
  )
}
