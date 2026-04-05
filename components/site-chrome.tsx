"use client"

import { Suspense } from "react"
import { usePathname } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { NavigationPageGate } from "@/components/navigation-page-gate"
import { RouteProgressBar } from "@/components/route-progress-bar"
import { AuthModalProvider } from "@/components/auth/auth-modal-context"
import { ImpersonationBanner } from "@/components/impersonation-banner"

function hideSiteChrome(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname.startsWith("/auth")
}

/**
 * Single persistent Header/Footer for the whole app so navigation does not remount
 * the nav bar. Auth routes stay full-bleed without this chrome.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (hideSiteChrome(pathname)) {
    return (
      <AuthModalProvider>
        <div className="flex min-h-dvh flex-col">
          <RouteProgressBar />
          <NavigationPageGate>{children}</NavigationPageGate>
        </div>
      </AuthModalProvider>
    )
  }
  return (
    <AuthModalProvider>
      <div className="flex min-h-dvh flex-col">
        <RouteProgressBar />
        <div className="sticky top-0 z-50 w-full bg-white pt-[env(safe-area-inset-top)]">
          <ImpersonationBanner />
          <Suspense fallback={<header className="min-h-[56px] border-b border-lightgray bg-white" aria-hidden />}>
            <Header />
          </Suspense>
        </div>
        <NavigationPageGate>{children}</NavigationPageGate>
        <Footer />
      </div>
    </AuthModalProvider>
  )
}
