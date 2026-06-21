import { AuthSessionCompletionPanel } from "@/components/auth/auth-session-completion-panel"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

export default async function Page(props: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const params = await props.searchParams

  return (
    <AuthSessionCompletionPanel
      redirectTo={safeRedirectPath(params?.redirect ?? null)}
    />
  )
}
