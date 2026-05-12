/** Must match `surfer-assets` bucket `file_size_limit` in migrations. */
export const SURFER_ASSET_STORED_MAX_BYTES = 5 * 1024 * 1024

/** Larger originals allowed before server-side WebP conversion. */
export const SURFER_ASSET_RAW_UPLOAD_MAX_BYTES = 25 * 1024 * 1024
