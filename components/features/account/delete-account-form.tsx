"use client"

import { useState } from "react"
import Link from "next/link"
import { Trash2 } from "lucide-react"
import { deleteMyAccountAction } from "@/lib/actions/accountDeletion"
import {
  ACCOUNT_DELETE_CONFIRMATION,
  ACCOUNT_DELETED_PATH,
  type AccountDeletionBlocker,
} from "@/lib/account-deletion"
import { signOutAndRedirect } from "@/lib/auth/sign-out-and-redirect"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface DeleteAccountFormProps {
  email: string | null
  blockers: AccountDeletionBlocker[]
}

export function DeleteAccountForm({ email, blockers }: DeleteAccountFormProps) {
  const [confirmation, setConfirmation] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blocked = blockers.length > 0
  const confirmationMatches = confirmation.trim() === ACCOUNT_DELETE_CONFIRMATION
  const canContinue = !blocked && confirmationMatches && !busy

  async function confirmDeletion() {
    setBusy(true)
    setError(null)
    try {
      const result = await deleteMyAccountAction({ confirmation })
      if ("error" in result) {
        setError(result.error)
        setDialogOpen(false)
        return
      }
      signOutAndRedirect(ACCOUNT_DELETED_PATH)
    } catch {
      setError("Couldn't delete your account right now. Try again.")
      setDialogOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {blocked ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-foreground">
          <p className="font-semibold">Finish these before you can delete</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {blockers.map((blocker) => (
              <li key={blocker.code}>
                {blocker.href ? (
                  <Link href={blocker.href} className="text-foreground underline underline-offset-2">
                    {blocker.message}
                  </Link>
                ) : (
                  blocker.message
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="delete-account-confirm" className="text-sm font-semibold">
          Type {ACCOUNT_DELETE_CONFIRMATION} to confirm
        </Label>
        {email ? (
          <p className="text-sm text-muted-foreground">
            This permanently deletes <span className="text-foreground">{email}</span>.
          </p>
        ) : null}
        <Input
          id="delete-account-confirm"
          autoComplete="off"
          spellCheck={false}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={ACCOUNT_DELETE_CONFIRMATION}
          disabled={blocked || busy}
          className="h-11 max-w-xs"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button
        type="button"
        variant="destructive"
        className="h-11 rounded-full px-6"
        disabled={!canContinue}
        onClick={() => setDialogOpen(true)}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Delete account
      </Button>

      <AlertDialog open={dialogOpen} onOpenChange={(open) => !busy && setDialogOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. Your listings will be removed and you won&apos;t be able to
              sign in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void confirmDeletion()}
            >
              {busy ? "Deleting…" : "Delete account"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
