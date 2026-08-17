/**
 * Canonical surfboard create URLs.
 * Default entry is experience-based — see {@link resolveDefaultSurfboardSellCreatePath}.
 */
export const SURFBOARD_SELL_BOARDS_CREATE_HREF = "/sell/boards?new=1"
export const SURFBOARD_SELL_QUICK_CREATE_HREF = "/sell/quick?new=1"
/**
 * `/sell` catalog search selection — always Guided boards, including guests
 * and first-time sellers. `from=catalog` skips the first-publisher Quick bounce.
 */
export const SURFBOARD_SELL_CATALOG_HANDOFF_HREF = "/sell/boards?new=1&from=catalog"

export function isSurfboardQuickCreatePath(href: string): boolean {
  return href === SURFBOARD_SELL_QUICK_CREATE_HREF || href.startsWith("/sell/quick")
}

export function isSurfboardCatalogHandoffFromParam(
  value: string | undefined,
): boolean {
  return value === "catalog"
}
