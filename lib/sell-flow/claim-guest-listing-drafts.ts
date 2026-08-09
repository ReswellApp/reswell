/** Claim guest server drafts onto the signed-in user (separate rows, never merge). */
export async function claimGuestListingDraftsClient(): Promise<string[]> {
  try {
    const res = await fetch("/api/listings/draft/claim", {
      method: "POST",
      credentials: "include",
    })
    if (!res.ok) return []
    const json = (await res.json()) as { data?: { claimedIds?: string[] } }
    return Array.isArray(json.data?.claimedIds) ? json.data.claimedIds : []
  } catch {
    return []
  }
}
