import { Suspense } from "react"
import { LoginLandingPageClient } from "@/components/auth/login-landing-page-client"
import { AuthTransitionShell } from "@/components/auth/auth-transition-shell"

export default function Page() {
  return (
    <Suspense fallback={<AuthTransitionShell ariaLabel="Loading sign in" />}>
      <LoginLandingPageClient />
    </Suspense>
  )
}
