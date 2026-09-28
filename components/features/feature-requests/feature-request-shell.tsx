import Link from "next/link"
import { ChevronRight } from "lucide-react"
import {
  FEATURE_REQUEST_CHANGELOG_PATH,
  FEATURE_REQUESTS_PATH,
} from "@/lib/utils/feature-requests"
import { cn } from "@/lib/utils"

interface FeatureRequestShellProps {
  active: "board" | "changelog" | "detail"
  code?: string
}

const INTRO = {
  board:
    "Tell us what would make buying and selling surf gear on Reswell better. Vote on ideas from other members, or report a bug. Reswell uses this board to decide what to build next.",
  changelog:
    "What we've shipped from this board. Vote on ideas to help us decide what comes next.",
} as const

export function FeatureRequestShell({ active, code }: FeatureRequestShellProps) {
  const tab = active === "changelog" ? "changelog" : "board"

  return (
    <header>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-neutral-500">
        <Link href="/" className="hover:text-neutral-800">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        {active === "detail" ? (
          <Link href={FEATURE_REQUESTS_PATH} className="hover:text-neutral-800">
            Feature requests
          </Link>
        ) : (
          <span className="text-neutral-800">Feature requests</span>
        )}
        {active === "detail" && code ? (
          <>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <span className="text-neutral-800">{code}</span>
          </>
        ) : null}
      </nav>

      <div className="mt-5 inline-flex items-center rounded-full bg-neutral-100 p-1">
        <Link
          href={FEATURE_REQUESTS_PATH}
          aria-current={tab === "board" ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1 text-sm transition-colors",
            tab === "board" ? "bg-white font-medium text-neutral-950 shadow-sm" : "text-neutral-600 hover:text-neutral-900",
          )}
        >
          Feature requests
        </Link>
        <Link
          href={FEATURE_REQUEST_CHANGELOG_PATH}
          aria-current={tab === "changelog" ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1 text-sm transition-colors",
            tab === "changelog"
              ? "bg-white font-medium text-neutral-950 shadow-sm"
              : "text-neutral-600 hover:text-neutral-900",
          )}
        >
          Changelog
        </Link>
      </div>

      {active === "detail" ? null : (
        <>
          <h1 className="mt-6 font-headline text-3xl font-bold tracking-tight text-neutral-950">
            {active === "changelog" ? "Changelog" : "Feature requests"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">{INTRO[active]}</p>
        </>
      )}
    </header>
  )
}
