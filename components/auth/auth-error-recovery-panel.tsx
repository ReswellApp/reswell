"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthSessionCompletionPanel } from "@/components/auth/auth-session-completion-panel"

type AuthErrorRecoveryPanelProps = {
  errorMessage?: string
  redirectTo?: string
}

/**
 * Email verification and other non-OAuth failures. Reuses session polling when a session
 * exists despite the upstream error.
 */
export function AuthErrorRecoveryPanel({
  errorMessage,
  redirectTo = "/dashboard",
}: AuthErrorRecoveryPanelProps) {
  return (
    <AuthSessionCompletionPanel
      redirectTo={redirectTo}
      ariaLabel="Completing sign in"
      failureFallback={
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-sm">
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">
                    Sorry, something went wrong.
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {errorMessage ? (
                    <p className="text-sm text-muted-foreground">
                      Code error: {errorMessage}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      An unspecified error occurred.
                    </p>
                  )}
                  <div className="mt-4 flex gap-2">
                    <Link
                      href="/auth/login"
                      className="inline-flex flex-1 items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                    >
                      Try logging in
                    </Link>
                    <Link
                      href="/"
                      className="inline-flex flex-1 items-center justify-center rounded-md border border-black bg-transparent px-4 py-2 text-sm font-medium text-black shadow-sm hover:bg-neutral-100 dark:border-white dark:text-white dark:hover:bg-white/10"
                    >
                      Go home
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      }
    />
  )
}
