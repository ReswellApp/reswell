import type { FinBoxType } from "@/lib/db/brand-model-variants"

/** Map listing `fins_setup` (comma-separated slugs and free-text mentions) to catalog fin boxes. */
export function finBoxTypeFromListingFinsSetup(raw: string | null | undefined): FinBoxType {
  const t = (raw ?? "").trim().toLowerCase()
  if (!t) return "futures"
  const parts = t
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.includes("single")) return "single_fin"
  if (t.includes("fcs")) return "fcs"
  return "futures"
}
