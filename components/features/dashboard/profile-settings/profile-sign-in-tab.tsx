"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, KeyRound, LogOut, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { ProfileChangePasswordSection } from "@/components/features/dashboard/profile-change-password-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  profileCardClass,
  profileInputClass,
  profileLabelClass,
  profilePillButtonClass,
  profileSectionHintClass,
  profileSectionTitleClass,
} from "@/components/features/dashboard/profile-settings/profile-settings-styles"
import type { ProfileChangePasswordCopy } from "@/components/features/dashboard/profile-change-password-section"

export type ProfileSignInTabCopy = ProfileChangePasswordCopy & {
  loginMethods: string
  signedInWithGoogle: string
  signedInWithEmail: string
  emailVerification: string
  verified: string
  changeEmailTitle: string
  newEmail: string
  updateEmail: string
  resetPassword: string
  resetPasswordDescription: string
  resetPasswordButton: string
  resetPasswordSending: string
  signOut: string
  signOutDescription: string
}

interface ProfileSignInTabProps {
  email: string
  copy: ProfileSignInTabCopy
  resetPasswordSending: boolean
  onSendPasswordReset: () => void
  onSignOut: () => void
}

export function ProfileSignInTab({
  email,
  copy,
  resetPasswordSending,
  onSendPasswordReset,
  onSignOut,
}: ProfileSignInTabProps) {
  const supabase = createClient()
  const [providerLabel, setProviderLabel] = useState<string>(copy.signedInWithEmail)

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      const providers = user?.app_metadata?.providers
      if (Array.isArray(providers) && providers.includes("google")) {
        setProviderLabel(copy.signedInWithGoogle)
      } else {
        setProviderLabel(copy.signedInWithEmail)
      }
    })
  }, [supabase, copy.signedInWithEmail, copy.signedInWithGoogle])

  return (
    <div className="mx-auto max-w-xl space-y-8 pt-2">
      <section className="space-y-4">
        <h2 className={profileSectionTitleClass}>{copy.loginMethods}</h2>
        <div className={`${profileCardClass} divide-y divide-neutral-200/80 px-5 py-1 sm:px-6`}>
          <div className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold">
              G
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{email || "—"}</p>
              <p className="text-sm text-muted-foreground">{providerLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-4">
            <Shield className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{copy.emailVerification}</p>
              <p className="text-sm text-muted-foreground">{copy.verified}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className={profileSectionTitleClass}>{copy.changeEmailTitle}</h2>
        <div className={`${profileCardClass} space-y-4 p-5 sm:p-6`}>
          <div className="space-y-2">
            <Label htmlFor="sign-in-email" className={profileLabelClass}>
              {copy.newEmail}
            </Label>
            <Input id="sign-in-email" type="email" className={profileInputClass} value={email} disabled readOnly />
          </div>
          <Button className={profilePillButtonClass(true)} disabled>
            {copy.updateEmail}
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className={profileSectionTitleClass}>{copy.changePassword}</h2>
        <div className={`${profileCardClass} p-5 sm:p-6`}>
          <ProfileChangePasswordSection email={email} copy={copy} />
        </div>
      </section>

      <section className={`${profileCardClass} space-y-4 p-5 sm:p-6`}>
        <div>
          <p className={profileSectionTitleClass}>{copy.resetPassword}</p>
          <p className={cn(profileSectionHintClass, "mt-1")}>{copy.resetPasswordDescription}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full px-6"
          onClick={onSendPasswordReset}
          disabled={resetPasswordSending || !email}
        >
          <KeyRound className="mr-2 h-4 w-4" aria-hidden />
          {resetPasswordSending ? copy.resetPasswordSending : copy.resetPasswordButton}
        </Button>
      </section>

      <section className={`${profileCardClass} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6`}>
        <div>
          <p className={profileSectionTitleClass}>{copy.signOut}</p>
          <p className={cn(profileSectionHintClass, "mt-1")}>{copy.signOutDescription}</p>
        </div>
        <Button type="button" variant="outline" className="h-11 shrink-0 rounded-full px-6" onClick={onSignOut}>
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          {copy.signOut}
        </Button>
      </section>
    </div>
  )
}
