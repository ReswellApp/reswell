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
import type { SiteChromeAuthPayload } from "@/lib/auth/get-site-chrome-auth"

function hideSiteChrome(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname.startsWith("/auth")
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
          <RouteProgressBar />
          <NavigationPageGate>{children}</NavigationPageGate>
        </div>
      </AuthModalProvider>
    )
  }
  return (
    <AuthModalProvider>
      <PasswordResetRequiredDialog />
      <div className="flex min-h-dvh flex-col">
        <RouteProgressBar />
        <div className="sticky top-0 z-50 w-full pt-[env(safe-area-inset-top)]">
          <ImpersonationBanner />
          <Suspense fallback={<header className="min-h-[56px] border-b border-border bg-white shadow-sm" aria-hidden />}>
            <Header serverHeaderAuth={headerAuth} />
          </Suspense>
        </div>
        <NavigationPageGate>{children}</NavigationPageGate>
        <Footer />
      </div>
    </AuthModalProvider>
  )
}
