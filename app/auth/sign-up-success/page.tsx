import { redirect } from "next/navigation"
import { SignUpWelcomePanel } from "@/components/auth/sign-up-welcome-panel"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { buildEmailSignUpSuccessPath } from "@/lib/google-ads/sign-up-success-path"
import { createClient } from "@/lib/supabase/server"

type PageProps = {
  searchParams: Promise<{ next?: string }>
}

/** Email / password sign-up confirmation landing page. */
export default async function SignUpSuccessPage({ searchParams }: PageProps) {
  const { next: nextRaw } = await searchParams
  const next = safeRedirectPath(nextRaw ?? null)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(
      `/auth/login?redirect=${encodeURIComponent(buildEmailSignUpSuccessPath(next))}`,
    )
  }

  return (
    <SignUpWelcomePanel
      nextPath={next}
      subtitle="Your Reswell account is ready. Here is what you can do next."
    />
  )
}
