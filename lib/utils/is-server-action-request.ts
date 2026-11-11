/**
 * Next.js Server Actions POST back to the current page URL with `Next-Action`.
 * The client requires `content-type: text/x-component`. An HTML redirect or
 * error page from middleware becomes:
 *
 *   Error: An unexpected response was received from the server.
 */

export function isServerActionRequest(request: {
  headers: { has(name: string): boolean }
}): boolean {
  return request.headers.has("next-action")
}
