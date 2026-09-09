"use client"

export type SaveDefaultListingLocationInput = {
  city: string
  state?: string
  lat?: number
  lng?: number
  display?: string
}

/** Profile default locality — route POST, never a Server Action on /sell. */
export function saveDefaultListingLocationClient(
  input: SaveDefaultListingLocationInput,
): void {
  void fetch("/api/sell/default-location", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    keepalive: true,
  }).catch(() => {
    /* best-effort — listing form already has the pin */
  })
}
