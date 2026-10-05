import { z } from "zod"

/**
 * Nearest international airport for an air-cargo shipment.
 * A 3-letter code is stored uppercase (LAX). Longer names are kept as typed,
 * with extra spaces collapsed.
 */
export const airCargoAirportSchema = z
  .string()
  .trim()
  .min(3, "Enter the nearest international airport.")
  .max(80, "Airport name is too long.")
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9 .,'’()\-/]{1,79}$/,
    "Use the airport name or its 3-letter code.",
  )
  .transform((value) => {
    const collapsed = value.replace(/\s+/g, " ")
    if (/^[A-Za-z]{3}$/.test(collapsed)) return collapsed.toUpperCase()
    return collapsed
  })

export function parseAirCargoAirport(
  value: unknown,
): { ok: true; airport: string } | { ok: false; error: string } {
  const parsed = airCargoAirportSchema.safeParse(value)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter the nearest international airport." }
  }
  return { ok: true, airport: parsed.data }
}
