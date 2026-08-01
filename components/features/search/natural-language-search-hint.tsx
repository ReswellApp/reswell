import Link from "next/link"
import { cn } from "@/lib/utils"

/**
 * Pango-style prompt for natural-language search on results pages.
 * Gemini compiles the query into `/boards` filters (condition, price, location, …).
 */
export function NaturalLanguageSearchHint({
  className,
  appliedLabels,
  summary,
}: {
  className?: string
  /** Chips from the last NL parse (shown when Gemini applied filters). */
  appliedLabels?: string[]
  summary?: string | null
}) {
  const examples = [
    {
      label: "Dumpster Diver 5'10 excellent under $600",
      href: "/boards?q=Dumpster%20Diver%205%2710%20excellent%20under%20%24600&nq=1",
    },
    {
      label: "CI fish near Santa Barbara with shipping",
      href: "/boards?q=CI%20fish%20near%20Santa%20Barbara%20with%20shipping&nq=1",
    },
  ] as const

  const hasApplied = (appliedLabels?.length ?? 0) > 0

  return (
    <aside
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-emerald-200/90 bg-emerald-50/90 px-3.5 py-3 sm:flex-row sm:items-start sm:gap-3",
        className,
      )}
    >
      <span className="inline-flex w-fit shrink-0 items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        New
      </span>
      <div className="min-w-0 flex-1 text-sm text-emerald-950">
        {hasApplied ? (
          <>
            <p className="font-medium leading-snug">
              Applied from your search
              {summary?.trim() ? (
                <span className="font-normal text-emerald-900/80"> — {summary.trim()}</span>
              ) : null}
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {appliedLabels!.map((label) => (
                <li
                  key={label}
                  className="rounded-md bg-white/80 px-2 py-0.5 text-xs font-medium text-emerald-950 ring-1 ring-emerald-200/80"
                >
                  {label}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="font-medium leading-snug">
              Try natural language in search —{" "}
              <span className="font-normal italic text-emerald-800">
                e.g. &ldquo;{examples[0].label}&rdquo;
              </span>
            </p>
            <p className="mt-0.5 text-xs text-emerald-900/75 sm:text-sm">
              We&apos;ll apply brand, model, length, condition, price, shipping, and location.
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-emerald-900/90">
              {examples.map((ex) => (
                <li key={ex.href}>
                  <Link
                    href={ex.href}
                    className="underline underline-offset-2 hover:text-emerald-950"
                  >
                    Try &ldquo;{ex.label}&rdquo;
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  )
}
