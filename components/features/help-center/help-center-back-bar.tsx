import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export function HelpCenterBackBar() {
  return (
    <div className="border-b border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 py-2.5 text-sm text-neutral-900 transition-colors hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 rounded-sm"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Reswell
        </Link>
      </div>
    </div>
  )
}
