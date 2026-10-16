"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  acceptAccountInviteAction,
  declineAccountInviteAction,
  inviteAccountMemberAction,
  revokeAccountMemberAction,
} from "@/lib/actions/accountMembers"
import type { GrantableAccountRole } from "@/lib/account-access/permissions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  profileCardClass,
  profileInputClass,
  profileLabelClass,
  profileSectionHintClass,
  profileSectionTitleClass,
} from "@/components/features/dashboard/profile-settings/profile-settings-styles"

export interface AccountTeamMemberView {
  id: string
  email: string
  role: GrantableAccountRole
  status: "invited" | "active"
  canRevoke: boolean
}

export interface AccountInviteView {
  id: string
  shopLabel: string
  role: GrantableAccountRole
}

interface AccountTeamPanelProps {
  canManage: boolean
  canInviteManager: boolean
  members: AccountTeamMemberView[]
  pendingInvites: AccountInviteView[]
  actingAsShop: boolean
  shopLabel: string
  actorEmail: string | null
  showShopAdminWarning: boolean
}

const ROLE_LABEL: Record<GrantableAccountRole, string> = {
  manager: "Manager",
  staff: "Staff",
}

export function AccountTeamPanel({
  canManage,
  canInviteManager,
  members,
  pendingInvites,
  actingAsShop,
  shopLabel,
  actorEmail,
  showShopAdminWarning,
}: AccountTeamPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<GrantableAccountRole>("staff")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function run(task: () => Promise<{ error?: string; success?: true }>, success: string) {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await task()
      if (result.error) {
        setError(result.error)
        return
      }
      setMessage(success)
      setEmail("")
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <section className="space-y-2">
        <h1 className={profileSectionTitleClass}>Team</h1>
        <p className={profileSectionHintClass}>
          {actingAsShop
            ? `You're signed in as ${actorEmail ?? "your email"} and working in ${shopLabel}.`
            : "Add other emails so people can sign in and help run this account. They keep their own login."}
        </p>
        {showShopAdminWarning ? (
          <p className={profileSectionHintClass}>
            Shop access does not open the Reswell admin panel. Employee access is a separate grant on their own login.
          </p>
        ) : null}
      </section>

      {pendingInvites.length > 0 ? (
        <section className={`${profileCardClass} space-y-4 p-5 sm:p-6`}>
          <h2 className={profileSectionTitleClass}>Invites for you</h2>
          {pendingInvites.map((invite) => (
            <div key={invite.id} className="flex flex-col gap-3 border-t border-neutral-200/80 pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{invite.shopLabel}</p>
                <p className="text-sm text-muted-foreground">{ROLE_LABEL[invite.role]}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={pending}
                  onClick={() => run(() => acceptAccountInviteAction({ memberId: invite.id }), "Invite accepted.")}
                >
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={pending}
                  onClick={() => run(() => declineAccountInviteAction({ memberId: invite.id }), "Invite declined.")}
                >
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {canManage ? (
        <section className={`${profileCardClass} space-y-4 p-5 sm:p-6`}>
          <div>
            <h2 className={profileSectionTitleClass}>Add an email</h2>
            <p className={`${profileSectionHintClass} mt-1`}>
              They sign up or sign in with this email, then accept the invite. Staff can run listings, orders, offers, and messages. Managers can also add staff. Payouts stay with the owner.
            </p>
          </div>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              run(() => inviteAccountMemberAction({ email, role }), "Invite saved. They'll see it after they sign in with that email.")
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="team-email" className={profileLabelClass}>Email</Label>
              <Input
                id="team-email"
                type="email"
                required
                autoComplete="email"
                className={profileInputClass}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-role" className={profileLabelClass}>Access</Label>
              <select
                id="team-role"
                className={profileInputClass}
                value={role}
                onChange={(event) => setRole(event.target.value === "manager" ? "manager" : "staff")}
              >
                <option value="staff">Staff</option>
                {canInviteManager ? <option value="manager">Manager</option> : null}
              </select>
            </div>
            <Button type="submit" className="h-11 rounded-full px-6" disabled={pending}>
              Add email
            </Button>
          </form>
        </section>
      ) : null}

      {members.length > 0 ? (
        <section className={`${profileCardClass} divide-y divide-neutral-200/80 px-5 py-1 sm:px-6`}>
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{member.email}</p>
                <p className="text-sm text-muted-foreground">
                  {ROLE_LABEL[member.role]} · {member.status === "invited" ? "Waiting for them to sign in" : "Active"}
                </p>
              </div>
              {member.canRevoke ? (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 rounded-full"
                  disabled={pending}
                  onClick={() => run(() => revokeAccountMemberAction({ memberId: member.id }), "Access removed.")}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  )
}
