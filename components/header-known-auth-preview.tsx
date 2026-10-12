/**
 * Avatar stand-in for the gap before hydration. The boot script fills it
 * from the remembered account; CSS shows it only while guest chrome is hidden.
 */
export function HeaderKnownAuthPreview() {
  return (
    <div data-rw-auth-preview className="shrink-0 items-center" aria-hidden>
      <span className="rw-header-preview-avatar inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full md:h-9 md:w-9" />
    </div>
  )
}
