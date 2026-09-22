/** Trimmed `/search` cache key parts — same results share one Data Cache entry. */
export function marketplaceSearchCacheParts(
  rawQuery: string,
  brandSlugFromUrl: string,
  categorySlugFromUrl: string,
): { rawQuery: string; brandSlug: string; categorySlug: string } {
  return {
    rawQuery: rawQuery.trim(),
    brandSlug: brandSlugFromUrl.trim(),
    categorySlug: categorySlugFromUrl.trim(),
  }
}
