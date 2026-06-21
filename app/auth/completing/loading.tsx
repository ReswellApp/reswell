import { AuthTransitionShell } from "@/components/auth/auth-transition-shell"

/** Match the completion panel — avoid surfboard skeleton flash on OAuth return. */
export default function AuthCompletingLoading() {
  return <AuthTransitionShell ariaLabel="Completing sign in" />
}
