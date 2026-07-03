import { Suspense } from "react"
import { SignUpLandingPageClient } from "@/components/auth/sign-up-landing-page-client"
import { AuthTransitionShell } from "@/components/auth/auth-transition-shell"

export default function Page() {
  return (
    <Suspense fallback={<AuthTransitionShell ariaLabel="Loading sign up" />}>
      <SignUpLandingPageClient />
    </Suspense>
  )
}
