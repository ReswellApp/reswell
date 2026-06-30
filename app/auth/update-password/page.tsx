"use client"

import { Suspense } from "react"
import { UpdatePasswordFormPanel } from "@/components/auth/update-password-form-panel"
import { AuthTransitionShell } from "@/components/auth/auth-transition-shell"

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<AuthTransitionShell ariaLabel="Loading password reset" />}>
      <UpdatePasswordFormPanel />
    </Suspense>
  )
}
