import type { ReactNode } from "react"
import Link from "next/link"
import { SiteWordmarkLink } from "@/components/site-wordmark-link"

interface ShopifyConsentShellProps {
  children: ReactNode
}

export function ShopifyConsentShell({ children }: ShopifyConsentShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="flex justify-center px-4 pt-8 sm:pt-10">
        <SiteWordmarkLink className="px-0 py-0" />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="flex justify-center gap-4 px-4 pb-8 text-xs text-muted-foreground">
        <Link href="/privacy" className="hover:text-foreground hover:underline">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-foreground hover:underline">
          Terms
        </Link>
        <Link href="/help" className="hover:text-foreground hover:underline">
          Help
        </Link>
      </footer>
    </div>
  )
}
