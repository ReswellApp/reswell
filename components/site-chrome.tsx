"use client"

import { usePathname } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { NavigationPageGate } from "@/components/navigation-page-gate"
import { RouteProgressBar } from "@/components/route-progress-bar"

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
      <div className="flex min-h-dvh flex-col">
        <RouteProgressBar />
        <NavigationPageGate>{children}</NavigationPageGate>
      </div>
    )
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <RouteProgressBar />
      <Header />
      <NavigationPageGate>{children}</NavigationPageGate>
      <Footer />
    </div>
  )
}
