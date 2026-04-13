'use client'

import '@/lib/supabase/install-browser-session-fetch'

/** Loads fetch patch with the root client bundle so RSC/API calls include the session header. */
export function BrowserSessionInit() {
  return null
}
