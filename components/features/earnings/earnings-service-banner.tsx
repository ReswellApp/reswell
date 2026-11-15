/**
 * Temporary earnings notice. Hidden after the end of November 18, 2026
 * in America/Los_Angeles (PST, UTC-8), which is 2026-11-19 08:00 UTC.
 */
const VISIBLE_UNTIL_MS = Date.parse("2026-11-19T08:00:00.000Z")

export function EarningsServiceBanner() {
  if (Date.now() >= VISIBLE_UNTIL_MS) return null

  return (
    <div
      role="status"
      className="rounded-2xl border border-amber-300/80 bg-amber-50 px-5 py-4 text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/40 dark:text-amber-50"
    >
      <p className="text-sm font-semibold leading-snug">
        This should be working by the end of the day on November 18.
      </p>
      <p className="mt-1 text-sm leading-relaxed">
        In the meantime, please bear with us. We apologize for the inconvenience.
      </p>
    </div>
  )
}
