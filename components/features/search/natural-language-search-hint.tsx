import Link from "next/link"
import { cn } from "@/lib/utils"

/**
 * Pango-style prompt for natural-language search on results pages.
 * Rules chips may show immediately; Gemini (via the parallel helper) can add more.
 * Colors: Reswell brand palette only (`lib/brand-colors.ts`).
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
      label: "boards with FCS thruster",
      href: "/boards?q=boards%20with%20FCS%20thruster&nq=1",
    },
  ] as const

  const hasApplied = (appliedLabels?.length ?? 0) > 0

  return (
    <aside
      className={cn(
        "relative overflow-hidden rounded-xl border border-[#7F9DD5]/40",
        "bg-gradient-to-br from-[#F9F9F2] via-white to-[#7F9DD5]/20",
        "shadow-[0_1px_0_0_rgba(4,7,14,0.04)]",
        className,
      )}
    >
      <div aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[#5574AD]" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[#7F9DD5]/25 blur-2xl"
      />

      <div className="relative px-4 py-3.5 pl-5">
        <div className="min-w-0 text-sm text-[#163060]">
          {hasApplied ? (
            <>
              <p className="font-headline text-[15px] font-semibold leading-snug tracking-tight">
                Applied from your search
                {summary?.trim() ? (
                  <span className="font-sans text-sm font-normal text-[#355185]">
                    {" "}
                    — {summary.trim()}
                  </span>
                ) : null}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {appliedLabels!.map((label) => (
                  <li
                    key={label}
                    className="rounded-full bg-white px-2.5 py-1 text-xs font-medium tracking-tight text-[#001A4A] ring-1 ring-[#7F9DD5]/45"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="font-headline text-[15px] font-semibold leading-snug tracking-tight">
                Try natural language in search
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#355185] sm:text-sm">
                Brand, model, length, condition, fins, tail, construction, price, shipping, and
                location —{" "}
                <span className="italic text-[#163060]">e.g. &ldquo;{examples[0].label}&rdquo;</span>
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
                {examples.map((ex) => (
                  <li key={ex.href}>
                    <Link
                      href={ex.href}
                      className="text-[#5574AD] underline decoration-[#7F9DD5]/70 underline-offset-[3px] transition-colors hover:text-[#466091] hover:decoration-[#5574AD]"
                    >
                      Try &ldquo;{ex.label}&rdquo;
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
