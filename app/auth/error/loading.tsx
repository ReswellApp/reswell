import { AuthTransitionShell } from "@/components/auth/auth-transition-shell"

/** Avoid surfboard skeleton flash while session sync runs after OAuth. */
export default function AuthErrorLoading() {
  return <AuthTransitionShell ariaLabel="Completing sign in" />
}
