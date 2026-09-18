export const COMPOSER_UNLOCK_DENIED_ERROR = "Couldn't send. Refresh and try again."

export function isComposerUnlockDeniedError(error: unknown): boolean {
  return error === COMPOSER_UNLOCK_DENIED_ERROR
}

export function marketplaceComposerUnlockDenied(): {
  error: typeof COMPOSER_UNLOCK_DENIED_ERROR
} {
  return { error: COMPOSER_UNLOCK_DENIED_ERROR }
}
