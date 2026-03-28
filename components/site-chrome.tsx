"use client"

import { usePathname } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { NavigationPageGate } from "@/components/navigation-page-gate"

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
    return <NavigationPageGate>{children}</NavigationPageGate>
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <NavigationPageGate>{children}</NavigationPageGate>
      <Footer />
    </div>
  )
}
