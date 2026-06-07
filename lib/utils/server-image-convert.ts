/** Vercel serverless request bodies are capped at ~4.5MB; stay under for FormData overhead. */
export const SERVER_IMAGE_CONVERT_MAX_BYTES = 4 * 1024 * 1024
