"use client"

import { X } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  AUTH_DRAWER_CONTENT_CLASS,
  AUTH_MODAL_CONTENT_CLASS,
  AUTH_MODAL_OVERLAY_CLASS,
} from "@/lib/auth/auth-modal-shell-classes"
import { LoginFormPanel } from "@/components/auth/login-form-panel"
import { SignUpFormPanel } from "@/components/auth/sign-up-form-panel"
import { ForgotPasswordFormPanel } from "@/components/auth/forgot-password-form-panel"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

type Mode = "login" | "sign-up" | "forgot-password"

function AuthModalForms({
  mode,
  onModeChange,
  redirectTo,
  onClose,
}: {
  mode: Mode
  onModeChange: (mode: Mode) => void
  redirectTo: string
  onClose: () => void
}) {
  if (mode === "login") {
    return (
      <LoginFormPanel
        variant="modal"
        redirectTo={redirectTo}
        onLoggedIn={onClose}
        onForgotPassword={() => onModeChange("forgot-password")}
        onSignUp={() => onModeChange("sign-up")}
        footerSignUp={
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-sm font-medium underline underline-offset-4"
            onClick={() => onModeChange("sign-up")}
          >
            Create one today
          </Button>
        }
      />
    )
  }

  if (mode === "sign-up") {
    return (
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
            Sign in
          </Button>
        }
      />
    )
  }

  return (
    <ForgotPasswordFormPanel
      variant="modal"
      onBackToLogin={() => onModeChange("login")}
    />
  )
}

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
  const isMobile = useIsMobile()
  const title =
    mode === "login"
      ? "Sign in to Reswell"
      : mode === "sign-up"
        ? "Create a Reswell account"
        : "Reset your password"

  const forms = (
    <AuthModalForms
      mode={mode}
      onModeChange={onModeChange}
      redirectTo={redirectTo}
      onClose={onClose}
    />
  )

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        shouldScaleBackground={false}
      >
        <DrawerContent
          showHandle={false}
          overlayClassName={AUTH_MODAL_OVERLAY_CLASS}
          className={AUTH_DRAWER_CONTENT_CLASS}
        >
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <DrawerClose
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground ring-offset-background transition-colors hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </DrawerClose>
          {forms}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        overlayClassName={AUTH_MODAL_OVERLAY_CLASS}
        className={cn(
          AUTH_MODAL_CONTENT_CLASS,
          (mode === "sign-up" || mode === "login") && "max-w-lg",
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {forms}
      </DialogContent>
    </Dialog>
  )
}
