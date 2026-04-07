"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { LoginFormPanel } from "@/components/auth/login-form-panel"
import { SignUpFormPanel } from "@/components/auth/sign-up-form-panel"
import { Button } from "@/components/ui/button"

type Mode = "login" | "sign-up"

export function AuthModal({
  open,
  onOpenChange,
  mode,
  onModeChange,
  redirectTo,
  onClose,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  onModeChange: (mode: Mode) => void
  redirectTo: string
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="z-[100] max-h-[min(90vh,720px)] w-[calc(100%-2rem)] max-w-md overflow-y-auto p-6 sm:p-8"
      >
        <DialogTitle className="sr-only">
          {mode === "login" ? "Sign in to Reswell" : "Create a Reswell account"}
        </DialogTitle>
        {mode === "login" ? (
          <LoginFormPanel
            variant="modal"
            redirectTo={redirectTo}
            onLoggedIn={onClose}
            footerSignUp={
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-base underline underline-offset-4"
                onClick={() => onModeChange("sign-up")}
              >
                Sign up
              </Button>
            }
          />
        ) : (
          <SignUpFormPanel
            variant="modal"
            redirectTo={redirectTo}
            onSignUpSuccess={onClose}
            footerLogin={
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-base underline underline-offset-4"
                onClick={() => onModeChange("login")}
              >
                Login
              </Button>
            }
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
