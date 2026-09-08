import { UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBusinessDate } from '@/lib/utils/business-timezone'
import type { AdminUserDetailProfileRow } from '@/lib/services/adminUserDetail'

interface AdminUserDetailAccessProps {
  profile: AdminUserDetailProfileRow
  onToggleVerified: () => void
  onToggleReswellSeller: () => void
  onToggleEmployee: () => void
  onToggleAdmin: () => void
}

function AccessRow({
  title,
  description,
  actionLabel,
  onClick,
  destructive,
}: {
  title: string
  description: string
  actionLabel: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant={destructive ? 'outline' : 'default'}
        className={destructive ? undefined : 'admin-btn-primary border-0'}
        onClick={onClick}
      >
        {actionLabel}
      </Button>
    </div>
  )
}

export function AdminUserDetailAccess({
  profile,
  onToggleVerified,
  onToggleReswellSeller,
  onToggleEmployee,
  onToggleAdmin,
}: AdminUserDetailAccessProps) {
  return (
    <section className="admin-surface p-5">
      <div className="flex items-center gap-2">
        <UserCog className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="font-headline text-sm font-semibold text-foreground">Access & badges</h2>
      </div>

      <div className="mt-4 space-y-5">
        <AccessRow
          title="Verified seller"
          description={
            profile.shop_verified
              ? `Badge visible on profile and listings${profile.shop_verified_at ? ` · since ${formatBusinessDate(profile.shop_verified_at)}` : ''}.`
              : 'Grant a verified badge for a trusted seller.'
          }
          actionLabel={profile.shop_verified ? 'Remove badge' : 'Grant badge'}
          destructive={profile.shop_verified}
          onClick={onToggleVerified}
        />
        <AccessRow
          title="Reswell seller"
          description={
            profile.is_reswell_seller
              ? '0% marketplace fee on this seller’s listings.'
              : 'Waive the marketplace fee for this seller.'
          }
          actionLabel={profile.is_reswell_seller ? 'Remove' : 'Grant'}
          destructive={profile.is_reswell_seller}
          onClick={onToggleReswellSeller}
        />
        <AccessRow
          title="Employee"
          description="Staff access to the admin console without super-admin rights."
          actionLabel={profile.is_employee ? 'Remove' : 'Grant'}
          destructive={profile.is_employee}
          onClick={onToggleEmployee}
        />
        <AccessRow
          title="Admin"
          description="Full admin console access. Granting this removes employee."
          actionLabel={profile.is_admin ? 'Remove' : 'Grant'}
          destructive={profile.is_admin}
          onClick={onToggleAdmin}
        />
      </div>
    </section>
  )
}
