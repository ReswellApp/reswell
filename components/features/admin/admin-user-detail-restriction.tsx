import { Loader2, Lock, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AdminStatusPill } from '@/components/features/admin/admin-status-pill'
import { formatBusinessDateTime } from '@/lib/utils/business-timezone'

export const ADMIN_RESTRICTION_PRESETS = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '24 hours', minutes: 60 * 24 },
  { label: '7 days', minutes: 60 * 24 * 7 },
] as const

export interface AdminAccountRestrictionState {
  restrictedUntil: string | null
  reason: string | null
  messageRateLimitedUntil: string | null
}

export function isFutureRestriction(iso: string | null | undefined): boolean {
  if (!iso) return false
  const ms = Date.parse(iso)
  return Number.isFinite(ms) && ms > Date.now()
}

interface RestrictionProps {
  loading: boolean
  saving: boolean
  isAdminUser: boolean
  restriction: AdminAccountRestrictionState | null
  reason: string
  selectedMinutes: number
  onReasonChange: (value: string) => void
  onSelectMinutes: (minutes: number) => void
  onApply: (restricted: boolean) => void
}

export function AdminUserDetailRestriction({
  loading,
  saving,
  isAdminUser,
  restriction,
  reason,
  selectedMinutes,
  onReasonChange,
  onSelectMinutes,
  onApply,
}: RestrictionProps) {
  const locked = isFutureRestriction(restriction?.restrictedUntil)

  return (
    <section className="admin-surface p-5">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="font-headline text-sm font-semibold text-foreground">Account restriction</h2>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading restriction status…
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {locked ? <AdminStatusPill label="Locked" tone="red" /> : <AdminStatusPill label="Active" tone="green" />}
            {locked && restriction?.restrictedUntil ? (
              <span className="text-sm text-muted-foreground">
                Until {formatBusinessDateTime(restriction.restrictedUntil)}
              </span>
            ) : restriction?.restrictedUntil ? (
              <span className="text-sm text-muted-foreground">Lock expired</span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Locked users can still sign in, but they cannot send messages or complete purchases.
          </p>
          {isFutureRestriction(restriction?.messageRateLimitedUntil) && restriction?.messageRateLimitedUntil ? (
            <p className="text-xs text-muted-foreground">
              Messaging cooldown until {formatBusinessDateTime(restriction.messageRateLimitedUntil)}
            </p>
          ) : null}
          {!locked ? (
            <>
              <div className="space-y-2">
                <Label>Lock duration</Label>
                <div className="flex flex-wrap gap-2">
                  {ADMIN_RESTRICTION_PRESETS.map((preset) => (
                    <Button
                      key={preset.minutes}
                      type="button"
                      size="sm"
                      variant={selectedMinutes === preset.minutes ? 'default' : 'outline'}
                      className={selectedMinutes === preset.minutes ? 'admin-btn-primary border-0' : undefined}
                      onClick={() => onSelectMinutes(preset.minutes)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="restriction-reason">Internal note (optional)</Label>
                <Input
                  id="restriction-reason"
                  value={reason}
                  onChange={(event) => onReasonChange(event.target.value)}
                  placeholder="Reason for lock"
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
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Lock account
              </Button>
              {isAdminUser ? (
                <p className="text-xs text-muted-foreground">Admin accounts cannot be locked from this screen.</p>
              ) : null}
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" className="gap-2" disabled={saving} onClick={() => onApply(false)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
              Remove lock
            </Button>
          )}
          {restriction?.reason ? <p className="text-xs text-muted-foreground">Note: {restriction.reason}</p> : null}
        </div>
      )}
    </section>
  )
}
