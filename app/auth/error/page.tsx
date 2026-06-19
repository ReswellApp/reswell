import { AuthErrorRecoveryPanel } from "@/components/auth/auth-error-recovery-panel"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

export default async function Page(props: {
  searchParams: Promise<{ error?: string; redirect?: string }>
}) {
  const params = await props.searchParams

  return (
    <AuthErrorRecoveryPanel
      errorMessage={params?.error}
      redirectTo={safeRedirectPath(params?.redirect ?? null)}
    />
  )
}
