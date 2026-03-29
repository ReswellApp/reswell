/**
 * Next.js prefetches `<Link>` targets in the viewport, so navigations to `/boards` often complete
 * before `loading.tsx` can paint. Disable prefetch for the surfboards browse routes so the
 * Reswell loading UI can show on click.
 */
export function boardsBrowseLinkPrefetch(href: string): boolean | undefined {
  return href === "/boards" || href.startsWith("/boards?") ? false : undefined
}
