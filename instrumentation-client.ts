import { installAbortErrorSuppressor } from '@/lib/client/install-abort-error-suppressor'
import { installChunkLoadRecovery } from '@/lib/client/install-chunk-load-recovery'

// Runs before React hydration so dev overlay ignores benign navigation aborts.
installAbortErrorSuppressor()

// Self-heal stale-chunk failures (common in long-lived in-app browser tabs after a deploy)
// at the window level, before the error-boundary bundle itself can fail to load and drop
// the user onto the in-app browser's native "This page couldn't load" screen.
installChunkLoadRecovery()
