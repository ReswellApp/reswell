import type { SupabaseClient } from '@supabase/supabase-js'

const SIGNUP_FETCH_CAP = 50000

export async function fetchProfileCreatedAtSince(
  db: SupabaseClient,
  sinceIso: string,
): Promise<string[]> {
  const { data, error } = await db
    .from('profiles')
    .select('created_at')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true })
    .limit(SIGNUP_FETCH_CAP)

  if (error) {
    console.error('[adminHomeSignups] profiles fetch failed', error.message)
    throw new Error('Could not load sign-up trend.')
  }

  return (data ?? [])
    .map((row) => {
      const createdAt = (row as { created_at?: unknown }).created_at
      return typeof createdAt === 'string' ? createdAt : null
    })
    .filter((value): value is string => Boolean(value))
}
