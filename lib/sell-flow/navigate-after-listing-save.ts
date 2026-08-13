/**
 * Full document navigation after listing create/update.
 *
 * Soft `router.push` / `router.replace` after a Server Action that revalidates
 * `/l/[listing]` deadlocks the App Router when that PDP is already in the
 * client cache (the usual edit path: listing → Edit → Save). The save overlay
 * never unmounts and the page appears frozen.
 */
export function navigateAfterListingSave(href: string): void {
  window.location.assign(href)
}
