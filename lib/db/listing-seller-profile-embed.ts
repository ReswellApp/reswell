/**
 * PostgREST embed for the listing owner's profile on `listings` selects.
 * When `listings.pending_buyer_id` exists, a second FK to `profiles` makes unqualified
 * `profiles(...)` ambiguous — PostgREST returns PGRST201 and no rows.
 */
export const LISTING_SELLER_PROFILES_EMBED = "profiles!listings_user_id_fkey" as const
