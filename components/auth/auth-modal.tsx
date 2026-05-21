"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  AUTH_MODAL_CONTENT_CLASS,
  AUTH_MODAL_OVERLAY_CLASS,
} from "@/lib/auth/auth-modal-shell-classes"
import { LoginFormPanel } from "@/components/auth/login-form-panel"
import { SignUpFormPanel } from "@/components/auth/sign-up-form-panel"
import { ForgotPasswordFormPanel } from "@/components/auth/forgot-password-form-panel"
import { Button } from "@/components/ui/button"

type Mode = "login" | "sign-up" | "forgot-password"

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
  const title =
    mode === "login"
      ? "Sign in to Reswell"
      : mode === "sign-up"
        ? "Create a Reswell account"
        : "Reset your password"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        overlayClassName={AUTH_MODAL_OVERLAY_CLASS}
        className={AUTH_MODAL_CONTENT_CLASS}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {mode === "login" ? (
          <LoginFormPanel
            variant="modal"
            redirectTo={redirectTo}
            onLoggedIn={onClose}
            onForgotPassword={() => onModeChange("forgot-password")}
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
        ) : mode === "sign-up" ? (
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
        ) : (
          <ForgotPasswordFormPanel
            variant="modal"
            onBackToLogin={() => onModeChange("login")}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
