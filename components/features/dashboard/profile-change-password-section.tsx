"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { HEADER_AUTH_REFRESH_EVENT } from "@/lib/auth/header-auth-refresh"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export type ProfileChangePasswordCopy = {
  changePassword: string
  changePasswordDescription: string
  changePasswordUnavailable: string
  changePasswordExpand: string
  changePasswordCollapse: string
  changePasswordCurrent: string
  changePasswordNew: string
  changePasswordConfirm: string
  changePasswordButton: string
  changePasswordSaving: string
  changePasswordSuccess: string
  changePasswordWrongCurrent: string
  changePasswordTooShort: string
  changePasswordMismatch: string
}

export function ProfileChangePasswordSection({
  email,
  copy,
}: {
  email: string
  copy: ProfileChangePasswordCopy
}) {
  const router = useRouter()
  const supabase = createClient()
  const [hasEmailPassword, setHasEmailPassword] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      const identities = user?.identities ?? []
      const ok = identities.some((i) => i.provider === "email")
      setHasEmailPassword(ok)
    })
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError(copy.changePasswordTooShort)
      return
    }
    if (newPassword !== confirmPassword) {
      setError(copy.changePasswordMismatch)
      return
    }

    const trimmedCurrent = currentPassword.trim()
    if (!trimmedCurrent) {
      setError(copy.changePasswordWrongCurrent)
      return
    }

    setSaving(true)
    try {
      // Supabase “Require current password when changing password” expects these fields on /user,
      // not only a prior signInWithPassword (see Password security docs).
      const { error: updateErr } = await supabase.auth.updateUser({
        email,
        password: newPassword,
        current_password: trimmedCurrent,
      })
      if (updateErr) {
        const msg = updateErr.message.toLowerCase()
        if (
          msg.includes("current password") ||
          msg.includes("invalid login credentials") ||
          updateErr.code === "invalid_credentials"
        ) {
          setError(copy.changePasswordWrongCurrent)
          return
        }
        throw updateErr
      }

      await supabase.auth.getSession()
      window.dispatchEvent(new Event(HEADER_AUTH_REFRESH_EVENT))
      toast.success(copy.changePasswordSuccess)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setOpen(false)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update password")
    } finally {
      setSaving(false)
    }
  }

  if (hasEmailPassword === null) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-foreground">{copy.changePassword}</p>
          <p className="text-sm text-muted-foreground">{copy.changePasswordDescription}</p>
        </div>
        <div className="h-10 w-28 animate-pulse rounded-md bg-muted" aria-hidden />
      </div>
    )
  }

  if (!hasEmailPassword) {
    return (
      <div className="flex flex-col gap-2">
        <p className="font-medium text-foreground">{copy.changePassword}</p>
        <p className="text-sm text-muted-foreground">{copy.changePasswordUnavailable}</p>
      </div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{copy.changePassword}</p>
          <p className="text-sm text-muted-foreground">{copy.changePasswordDescription}</p>
        </div>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 self-start sm:self-auto"
            aria-expanded={open}
          >
            {open ? copy.changePasswordCollapse : copy.changePasswordExpand}
            <ChevronDown
              className={cn("ml-2 h-4 w-4 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-4 space-y-4">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 max-w-md">
          <div className="grid gap-2">
            <Label htmlFor="profile-current-password">{copy.changePasswordCurrent}</Label>
            <Input
              id="profile-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-new-password">{copy.changePasswordNew}</Label>
            <Input
              id="profile-new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-confirm-password">{copy.changePasswordConfirm}</Label>
            <Input
              id="profile-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-neutral-700">{error}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? copy.changePasswordSaving : copy.changePasswordButton}
          </Button>
        </form>
      </CollapsibleContent>
    </Collapsible>
  )
}
