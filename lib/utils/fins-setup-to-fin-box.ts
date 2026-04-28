import type { FinBoxType } from "@/lib/db/brand-model-variants"

/** Map listing `fins_setup` to catalog fin boxes; default to futures when ambiguous. */
export function finBoxTypeFromListingFinsSetup(raw: string | null | undefined): FinBoxType {
  const t = (raw ?? "").trim().toLowerCase()
  if (t === "single") return "single_fin"
  return "futures"
}
