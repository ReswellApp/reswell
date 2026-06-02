import { z } from "zod"

/**
 * Body for `POST /api/integrations/meta/view-content` — the browser pixel reports a product
 * ViewContent so the server can mirror it to the Meta Conversions API with the same `event_id`.
 */
export const metaViewContentBodySchema = z.object({
  listing_id: z.string().trim().min(1).max(64),
  /** Shared with the browser ViewContent so Meta deduplicates the pair. */
  event_id: z.string().trim().min(1).max(128),
  value: z.number().positive().finite().optional(),
  currency: z.string().trim().length(3).optional(),
  listing_slug: z.string().trim().max(256).optional(),
  listing_section: z.string().trim().max(64).optional(),
  /** Real page URL from the browser (event_source_url). */
  source_url: z.string().trim().url().max(2048).optional(),
})

export type MetaViewContentBody = z.infer<typeof metaViewContentBodySchema>
