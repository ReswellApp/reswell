"use client"

import { Suspense } from "react"
import { usePathname } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { NavigationPageGate } from "@/components/navigation-page-gate"
import { RouteProgressBar } from "@/components/route-progress-bar"
import { AuthModalProvider } from "@/components/auth/auth-modal-context"
import { ImpersonationBanner } from "@/components/impersonation-banner"
import { PasswordResetRequiredDialog } from "@/components/auth/password-reset-required-dialog"
import { ProfileCompletionRouteGuard } from "@/components/auth/profile-completion-route-guard"
import type { SiteChromeAuthPayload } from "@/lib/auth/get-site-chrome-auth"
import { cn } from "@/lib/utils"

function hideSiteChrome(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname.startsWith("/auth") || pathname === "/help" || pathname.startsWith("/help/")
}

/** Messages inbox + threads use full vertical space without the marketing footer. */
function hideFooter(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname === "/messages" || pathname.startsWith("/messages/")
}

/**
 * Client shell: pathname gates chrome, mounts interactive header from server snapshot.
 */
export function SiteChromeClient({
  children,
  headerAuth,
}: {
  children: React.ReactNode
  headerAuth: SiteChromeAuthPayload
}) {
  const pathname = usePathname()
  if (hideSiteChrome(pathname)) {
    return (
      <AuthModalProvider>
        <div className="flex min-h-dvh flex-col">
          <PasswordResetRequiredDialog />
          <ProfileCompletionRouteGuard />
          <RouteProgressBar />
          <NavigationPageGate>{children}</NavigationPageGate>
        </div>
      </AuthModalProvider>
    )
  }
  return (
    <AuthModalProvider>
      <PasswordResetRequiredDialog />
      <ProfileCompletionRouteGuard />
      <div className="flex min-h-dvh flex-col">
        <RouteProgressBar />
        <div className="sticky top-0 z-50 isolate w-full bg-background pt-[env(safe-area-inset-top)]">
          <ImpersonationBanner />
          <Suspense fallback={<header className="min-h-[56px] border-b border-border bg-background shadow-sm" aria-hidden />}>
            <Header serverHeaderAuth={headerAuth} />
          </Suspense>
        </div>
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            hideFooter(pathname)
              ? "pb-[env(safe-area-inset-bottom)]"
              : "pb-10 sm:pb-12 md:pb-16",
          )}
        >
          <NavigationPageGate>{children}</NavigationPageGate>
        </div>
        {!hideFooter(pathname) ? <Footer /> : null}
      </div>
    </AuthModalProvider>
  )
}
