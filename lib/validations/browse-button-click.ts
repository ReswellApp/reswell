import { z } from "zod"

import { BROWSE_BUTTON_CATEGORIES, BROWSE_BUTTON_KEYS } from "@/lib/browse-button-tracking"

export const browseButtonClickSchema = z
  .object({
    category: z.enum(BROWSE_BUTTON_CATEGORIES),
    button: z.enum(BROWSE_BUTTON_KEYS),
    /**
     * ship_to_me: enabled|disabled
     * filter: mobile|desktop
     * facet: select|deselect|set|clear
     */
    detail: z
      .enum(["enabled", "disabled", "mobile", "desktop", "select", "deselect", "set", "clear"])
      .optional(),
    /** Facet param key, e.g. style, condition, brand, price */
    facetKey: z.string().trim().min(1).max(80).optional(),
    /** Option value or committed text (brand name, price range, …) */
    facetValue: z.string().trim().max(200).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.button === "facet" && !val.facetKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "facetKey is required for facet clicks",
        path: ["facetKey"],
      })
    }
  })

export type BrowseButtonClickInput = z.infer<typeof browseButtonClickSchema>
