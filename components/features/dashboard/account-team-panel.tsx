"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Check, ChevronDown } from "lucide-react"
import {
  acceptAccountInviteAction,
  declineAccountInviteAction,
  inviteAccountMemberAction,
  revokeAccountMemberAction,
  setActiveShopAccountAction,
} from "@/lib/actions/accountMembers"
import type { GrantableAccountRole } from "@/lib/account-access/permissions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  profileCardClass,
  profileInputClass,
  profileLabelClass,
  profileSectionHintClass,
  profileSectionTitleClass,
} from "@/components/features/dashboard/profile-settings/profile-settings-styles"
import type { AccountTeamPanelData } from "@/lib/services/accountAccess"

const ROLE_LABEL: Record<GrantableAccountRole, string> = {
  manager: "Manager",
  staff: "Staff",
}

const ROLE_DETAIL: Record<GrantableAccountRole, string> = {
  staff: "Runs the shop, except earnings and payouts",
  manager: "Runs the shop, except earnings and payouts",
}

function AccountOpenRow({
  initials,
  title,
  detail,
  tone,
  active,
  pending,
  onOpen,
}: {
  initials: string
  title: string
  detail: string
  tone: "personal" | "shop"
  active: boolean
  pending: boolean
  onOpen: () => void
}) {
  return (
    <li className="flex items-center gap-3 px-5 py-4 sm:px-6">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          tone === "shop" ? "bg-neutral-950 text-white" : "bg-neutral-100 text-foreground",
        )}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
      {active ? (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
          <Check className="h-3.5 w-3.5" aria-hidden />
          Open
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 rounded-full px-4"
          disabled={pending}
          onClick={onOpen}
        >
          Open
        </Button>
      )}
    </li>
  )
}

function emailInitials(email: string): string {
  const local = email.split("@")[0] ?? ""
  const parts = local.split(/[._+-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()
  }
  const compact = local.replace(/[^a-zA-Z0-9]/g, "")
  return (compact.slice(0, 2) || "?").toUpperCase()
}

export function AccountTeamPanel({
  canManage,
  canInviteManager,
  members,
  pendingInvites,
  memberships,
  actingAsShop,
  shopLabel,
  actorEmail,
  showShopAdminWarning,
}: AccountTeamPanelData) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<GrantableAccountRole>("staff")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)

  function openAccount(accountId: string | null) {
    setSwitchError(null)
    startTransition(async () => {
      const result = await setActiveShopAccountAction({ accountId })
      if ("error" in result && result.error) {
        setSwitchError(result.error)
        return
      }
      router.refresh()
    })
  }

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

  const hasAnythingToShow =
    canManage || members.length > 0 || pendingInvites.length > 0 || memberships.length > 0
  if (!hasAnythingToShow) return null

  return (
    <section className="space-y-8">
      {memberships.length > 0 ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className={profileSectionTitleClass}>Accounts</h2>
            <p className={profileSectionHintClass}>
              Open the account you want to work in. Personal is your own login
              {actorEmail ? ` (${actorEmail})` : ""}. Shops are accounts that accepted that email.
            </p>
          </div>
          {switchError ? (
            <p className="text-sm text-destructive" role="alert">
              {switchError}
            </p>
          ) : null}
          <ul className={`${profileCardClass} divide-y divide-neutral-200/80`}>
            <AccountOpenRow
              initials={emailInitials(actorEmail ?? "me")}
              title="Personal"
              detail="Your login"
              tone="personal"
              active={!actingAsShop}
              pending={pending}
              onOpen={() => openAccount(null)}
            />
            {memberships.map((membership) => (
              <AccountOpenRow
                key={membership.accountId}
                initials={emailInitials(membership.label)}
                title={membership.label}
                detail={ROLE_LABEL[membership.role]}
                tone="shop"
                active={membership.active}
                pending={pending}
                onOpen={() => openAccount(membership.accountId)}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {pendingInvites.length > 0 ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className={profileSectionTitleClass}>Invitations</h2>
            <p className={profileSectionHintClass}>
              Accept to work in that shop with your own email.
            </p>
          </div>
          <ul className={`${profileCardClass} divide-y divide-neutral-200/80`}>
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold">
                    {emailInitials(invite.shopLabel)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{invite.shopLabel}</p>
                    <p className="text-sm text-muted-foreground">
                      {ROLE_LABEL[invite.role]} · {ROLE_DETAIL[invite.role]}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 sm:shrink-0">
                  <Button
                    type="button"
                    className="h-9 rounded-full px-4"
                    disabled={pending}
                    onClick={() =>
                      run(() => acceptAccountInviteAction({ memberId: invite.id }), "You're on the team.")
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-full px-4"
                    disabled={pending}
                    onClick={() =>
                      run(() => declineAccountInviteAction({ memberId: invite.id }), "Invite declined.")
                    }
                  >
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canManage || members.length > 0 ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className={profileSectionTitleClass}>
              {actingAsShop ? `${shopLabel} team` : "Team"}
            </h2>
            <p className={profileSectionHintClass}>
              {actingAsShop
                ? `You're signed in as ${actorEmail ?? "your email"} and working in this shop.`
                : "People you add sign in with their own email, then work inside this account. Payouts stay with you."}
            </p>
            {showShopAdminWarning ? (
              <p className={profileSectionHintClass}>
                Shop access does not open the Reswell admin panel.
              </p>
            ) : null}
          </div>

          {canManage ? (
            <form
              className={`${profileCardClass} space-y-4 p-5 sm:p-6`}
              onSubmit={(event) => {
                event.preventDefault()
                run(
                  () => inviteAccountMemberAction({ email, role }),
                  "Invite saved. They'll see it the next time they sign in with that email.",
                )
              }}
            >
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              {message ? (
                <p className="text-sm text-foreground" role="status">
                  {message}
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <div className="space-y-2">
                  <Label htmlFor="team-email" className={profileLabelClass}>
                    Email
                  </Label>
                  <Input
                    id="team-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@email.com"
                    className={profileInputClass}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-role" className={profileLabelClass}>
                    Access
                  </Label>
                  <div className="relative">
                    <select
                      id="team-role"
                      className={cn(profileInputClass, "w-full appearance-none px-3 pr-9")}
                      value={role}
                      onChange={(event) => setRole(event.target.value === "manager" ? "manager" : "staff")}
                    >
                      <option value="staff">Staff</option>
                      {canInviteManager ? <option value="manager">Manager</option> : null}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
              <Button type="submit" className="h-11 rounded-full px-6" disabled={pending}>
                {pending ? "Saving…" : "Invite"}
              </Button>
            </form>
          ) : error || message ? (
            <div className="space-y-1">
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              {message ? (
                <p className="text-sm text-muted-foreground" role="status">
                  {message}
                </p>
              ) : null}
            </div>
          ) : null}

          {members.length > 0 ? (
            <ul className={`${profileCardClass} divide-y divide-neutral-200/80`}>
              {members.map((member) => {
                const waiting = member.status === "invited"
                return (
                  <li key={member.id} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold">
                      {emailInitials(member.email)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{member.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {ROLE_LABEL[member.role]}
                        <span className="px-1.5 text-neutral-300">·</span>
                        {waiting ? "Invite pending" : "Active"}
                      </p>
                    </div>
                    {member.canRevoke ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 shrink-0 rounded-full px-3 text-muted-foreground"
                        disabled={pending}
                        onClick={() =>
                          run(() => revokeAccountMemberAction({ memberId: member.id }), "Access removed.")
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
