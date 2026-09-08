/** Supabase filter: only real marketplace sales (not admin test seeds). */
export const REAL_MARKETPLACE_SALES_FILTER = { is_admin_test: false } as const

/** Supabase filter: only real marketplace purchases (not admin test seeds). */
export const REAL_MARKETPLACE_PURCHASES_FILTER = { is_admin_test: false } as const
