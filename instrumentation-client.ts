import { installAbortErrorSuppressor } from '@/lib/client/install-abort-error-suppressor'

// Runs before React hydration so dev overlay ignores benign navigation aborts.
installAbortErrorSuppressor()
