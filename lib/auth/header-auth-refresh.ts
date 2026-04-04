/** Dispatched after password sign-in (e.g. auth modal) so the shell re-reads Supabase session without a full reload. */
export const HEADER_AUTH_REFRESH_EVENT = "reswell:auth-refresh" as const
