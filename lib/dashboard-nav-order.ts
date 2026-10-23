/** Insert a nav item immediately after the link with `afterHref`. Appends when that href is missing. */
export function insertNavLinkAfter<T extends { href: string }>(
  links: readonly T[],
  item: T,
  afterHref: string,
): T[] {
  const index = links.findIndex((link) => link.href === afterHref)
  if (index < 0) return [...links, item]
  return [...links.slice(0, index + 1), item, ...links.slice(index + 1)]
}
