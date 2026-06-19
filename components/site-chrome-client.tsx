"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { forceReleaseBodyScrollLock } from "@/hooks/use-body-scroll-lock"
import { Header } from "@/components/header"
import { SiteHeaderShell } from "@/components/site-header-shell"
import {
  shouldShowSiteTopCategoryBar,
  SiteTopCategoryBar,
} from "@/components/site-top-category-bar"
import { Footer } from "@/components/footer"
import { NavigationPageGate } from "@/components/navigation-page-gate"
import { RouteProgressBar } from "@/components/route-progress-bar"
import { AuthModalProvider } from "@/components/auth/auth-modal-context"
import { ImpersonationBanner } from "@/components/impersonation-banner"
import { PasswordResetRequiredDialog } from "@/components/auth/password-reset-required-dialog"
import { ProfileCompletionRequiredDialog } from "@/components/auth/profile-completion-required-dialog"
import { NewsletterPromoPopup } from "@/components/features/marketing/newsletter-promo-popup"
import type { SiteChromeAuthPayload } from "@/lib/auth/get-site-chrome-auth"
import {
  isMessageThreadDetailRoute,
  isMessagesDesktopShellRoute,
} from "@/lib/utils/message-thread-routes"
import { useFlatMobileMessagesInbox } from "@/hooks/use-flat-mobile-messages-inbox"
import { useMobileLg } from "@/hooks/use-mobile-lg"
import { cn } from "@/lib/utils"

function hideSiteChrome(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname.startsWith("/auth") || pathname === "/help" || pathname.startsWith("/help/")
}

/** Full-height flows without the marketing footer (messages, sell listing). */
function hideFooter(pathname: string | null): boolean {
  if (!pathname) return false
  return (
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    pathname === "/sell" ||
    pathname.startsWith("/sell/") ||
    pathname.startsWith("/import/")
  )
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
  const flatMobileMessagesInbox = useFlatMobileMessagesInbox()
  const isMobileLg = useMobileLg()
  // Lock the viewport to a fixed-height app shell on conversation threads at
  // every breakpoint: the page itself never scrolls, only the message list
  // does, and the composer pins to the bottom — an app-like, not page-like feel.
  const lockThreadViewport = isMessageThreadDetailRoute(pathname)
  // Desktop inbox split view: cap the shell height so the chat list scrolls inside the card.
  const lockDesktopMessagesShell =
    !isMobileLg && isMessagesDesktopShellRoute(pathname)
  const lockViewport = lockThreadViewport || lockDesktopMessagesShell

  useEffect(() => {
    forceReleaseBodyScrollLock()
  }, [pathname])

  useEffect(() => {
    forceReleaseBodyScrollLock()
    const onPageShow = () => forceReleaseBodyScrollLock()
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [])

  if (hideSiteChrome(pathname)) {
    return (
      <AuthModalProvider>
        <div className="flex min-h-dvh flex-col">
          <PasswordResetRequiredDialog />
          <ProfileCompletionRequiredDialog />
          <NewsletterPromoPopup serverUser={headerAuth.user} />
          <RouteProgressBar />
          <NavigationPageGate>{children}</NavigationPageGate>
        </div>
      </AuthModalProvider>
    )
  }
  return (
    <AuthModalProvider>
      <PasswordResetRequiredDialog />
      <ProfileCompletionRequiredDialog />
      <NewsletterPromoPopup serverUser={headerAuth.user} />
      <div
        className={cn(
          "flex flex-col",
          lockViewport ? "h-dvh max-h-dvh overflow-hidden" : "min-h-dvh",
        )}
      >
        <RouteProgressBar />
        <SiteHeaderShell>
          <ImpersonationBanner />
          <Header serverHeaderAuth={headerAuth} />
        </SiteHeaderShell>
        <div
          className={cn(
            "flex flex-col pt-[var(--site-header-height,4rem)]",
            flatMobileMessagesInbox ? "flex-none" : "min-h-0 flex-1",
            lockViewport && "overflow-hidden",
            hideFooter(pathname)
              ? "pb-[env(safe-area-inset-bottom)]"
              : "pb-10 sm:pb-12 md:pb-16",
          )}
        >
          {shouldShowSiteTopCategoryBar(pathname) ? <SiteTopCategoryBar /> : null}
          <NavigationPageGate>{children}</NavigationPageGate>
        </div>
        {!hideFooter(pathname) ? <Footer /> : null}
      </div>
    </AuthModalProvider>
  )
}
