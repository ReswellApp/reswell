import { Ban, Loader2, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AdminStatusPill } from '@/components/features/admin/admin-status-pill'
import { formatBusinessDateTime } from '@/lib/utils/business-timezone'

export interface AdminSellerBanState {
  banned: boolean
  sellerBannedAt: string | null
  sellerBannedReason: string | null
}

interface BanProps {
  loading: boolean
  saving: boolean
  isAdminUser: boolean
  ban: AdminSellerBanState | null
  reason: string
  onReasonChange: (value: string) => void
  onApply: (banned: boolean) => void
}

export function AdminUserDetailSellerBan({
  loading,
  saving,
  isAdminUser,
  ban,
  reason,
  onReasonChange,
  onApply,
}: BanProps) {
  return (
    <section className="admin-surface p-5">
      <div className="flex items-center gap-2">
        <Ban className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="font-headline text-sm font-semibold text-foreground">Seller ban</h2>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading seller ban status…
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {ban?.banned ? (
              <AdminStatusPill label="Seller banned" tone="red" />
            ) : (
              <AdminStatusPill label="Can sell" tone="green" />
            )}
            {ban?.banned && ban.sellerBannedAt ? (
              <span className="text-sm text-muted-foreground">
                Since {formatBusinessDateTime(ban.sellerBannedAt)}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Banned sellers can still buy and message, but live listings move to delinquent and they cannot
            make listings live.
          </p>
          {!ban?.banned ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="seller-ban-reason">Internal note (optional)</Label>
                <Input
                  id="seller-ban-reason"
                  value={reason}
                  onChange={(event) => onReasonChange(event.target.value)}
                  placeholder="Reason for seller ban"
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
                Ban seller
              </Button>
              {isAdminUser ? (
                <p className="text-xs text-muted-foreground">
                  Admin accounts cannot be seller-banned from this screen.
                </p>
              ) : null}
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" className="gap-2" disabled={saving} onClick={() => onApply(false)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
              Remove seller ban
            </Button>
          )}
          {ban?.sellerBannedReason ? (
            <p className="text-xs text-muted-foreground">Note: {ban.sellerBannedReason}</p>
          ) : null}
        </div>
      )}
    </section>
  )
}
