"use server"

import { after } from "next/server"
import { revalidateNavSearchSuggest } from "@/lib/cache/revalidate-nav-search-suggest"

/** Call after a listing goes live (create or draft → publish). */
export async function revalidateNavSearchSuggestAfterListingPublished(): Promise<void> {
  after(() => {
    revalidateNavSearchSuggest()
  })
}
