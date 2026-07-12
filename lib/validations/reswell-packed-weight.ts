import { z } from "zod"
import { validateReswellPackedWeightRequired } from "@/lib/reswell-parcel-fields"

/** Adds Zod issues for required Reswell packed weight fields on listing schemas. */
export function addReswellPackedWeightZodIssues(
  lbRaw: string | undefined,
  ozRaw: string | undefined,
  ctx: z.RefinementCtx,
): void {
  const message = validateReswellPackedWeightRequired(lbRaw, ozRaw)
  if (!message) return
  if (message.includes("Ounces must be under 16")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Ounces must be under 16.",
      path: ["reswellPackageWeightOz"],
    })
    return
  }
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message,
    path: ["reswellPackageWeightLb"],
  })
}
