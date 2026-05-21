"use client"

import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { SiteWordmarkLink } from "@/components/site-wordmark-link"
import { useLocale } from "@/components/locale-provider"
import type { Locale } from "@/lib/translations"
import { cn } from "@/lib/utils"

const localeLabels: Record<Locale, string> = {
  en: "English (United States)",
  es: "Español",
}

export function HelpCenterHeader({ className }: { className?: string }) {
  const { locale, setLocale, supportedLocales } = useLocale()

  return (
    <header
      className={cn(
        "border-b border-neutral-200 bg-white",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <SiteWordmarkLink href="/help" variant="header" className="px-0" />
          <Link
            href="/help"
            className="truncate text-lg font-bold text-neutral-900 sm:text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 rounded-sm"
          >
            Help Center
          </Link>
        </div>

        <label className="relative shrink-0">
          <span className="sr-only">Language</span>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="appearance-none rounded-md border border-neutral-200 bg-white py-2 pl-3 pr-9 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
          >
            {supportedLocales.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {localeLabels[opt.value] ?? opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
            aria-hidden
          />
        </label>
      </div>
    </header>
  )
}
