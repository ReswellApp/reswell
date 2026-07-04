import { z } from "zod"
import { finListingDraftAutosaveSchema } from "@/lib/validations/fin-listing-draft-autosave"
import { listingDraftAutosaveSchema } from "@/lib/validations/listing-draft-autosave"

export const listingDraftSaveSchema = z.discriminatedUnion("section", [
  listingDraftAutosaveSchema.extend({ section: z.literal("surfboards") }),
  finListingDraftAutosaveSchema.extend({ section: z.literal("fins") }),
])

export type ListingDraftSaveInput = z.infer<typeof listingDraftSaveSchema>
