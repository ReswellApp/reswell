/** HTTP Link header value for a listing document. */
export function listingAgentLinkHeader(origin: string, listingParam: string): string {
  const base = origin.replace(/\/$/, "")
  const id = encodeURIComponent(listingParam)
  return [
    `<${base}/api/public/listings/${id}>; rel="alternate"; type="application/json"`,
    `<${base}/llms.txt>; rel="describedby"; type="text/plain"`,
  ].join(", ")
}
