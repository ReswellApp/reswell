/**
 * Prefetch is enabled for `/boards` category views — listing grids are cached hourly
 * (`boards-browse` tag) so navigations between nav pills stay fast.
 */
export function boardsBrowseLinkPrefetch(_href: string): boolean | undefined {
  return undefined
}
