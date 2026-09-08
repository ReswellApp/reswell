'use client'

import type { ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { AdminStatusPill } from '@/components/features/admin/admin-status-pill'
import {
  formatBusinessDate,
  formatBusinessDateTime,
  BUSINESS_TIMEZONE_LABEL,
} from '@/lib/utils/business-timezone'
import type { AdminUserAuthFacts, AdminUserCommerce } from '@/lib/services/adminUserDetail'
import { formatAdminUsd } from '@/lib/admin/admin-user-detail-display'

interface AdminUserDetailAccountProps {
  userId: string
  joinedAt: string
  verifiedAt: string | null
  auth: AdminUserAuthFacts
  commerce: AdminUserCommerce
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}

async function copyValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`)
  }
}

export function AdminUserDetailAccount({
  userId,
  joinedAt,
  verifiedAt,
  auth,
  commerce,
}: AdminUserDetailAccountProps) {
  const joinedLabel = formatBusinessDateTime(joinedAt)
  const lastSignIn = formatBusinessDateTime(auth.lastSignInAt)
  const accountAge = joinedAt
    ? formatDistanceToNow(new Date(joinedAt), { addSuffix: true })
    : '—'

  return (
    <section className="admin-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-headline text-sm font-semibold text-foreground">Account</h2>
        <p className="text-xs text-muted-foreground">{BUSINESS_TIMEZONE_LABEL}</p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Fact label="Signed up with">{auth.signupMethodLabel}</Fact>
        <Fact label="Email">
          {auth.emailConfirmed ? (
            <AdminStatusPill label="Confirmed" tone="green" />
          ) : (
            <AdminStatusPill label="Unconfirmed" tone="amber" />
          )}
        </Fact>
        <Fact label="Joined">{joinedLabel}</Fact>
        <Fact label="Last sign-in">{lastSignIn}</Fact>
        <Fact label="Account age">{accountAge}</Fact>
        <Fact label="Verified seller">
          {verifiedAt ? formatBusinessDate(verifiedAt) : 'Not verified'}
        </Fact>
        <Fact label="Purchases">
          {commerce.buyerPurchases} · {formatAdminUsd(commerce.buyerSpend)}
        </Fact>
        {auth.providers.length > 1 ? (
          <Fact label="Linked providers">{auth.providers.join(', ')}</Fact>
        ) : null}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">User ID</p>
          <p className="truncate font-mono text-xs text-foreground">{userId}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => void copyValue(userId, 'User ID')}
        >
          <Copy className="h-3.5 w-3.5" />
          <span className="sr-only">Copy user ID</span>
        </Button>
      </div>
    </section>
  )
}
