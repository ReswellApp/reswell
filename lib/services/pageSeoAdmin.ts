import { MANAGED_PAGES } from "@/lib/seo/managed-pages"
import { DYNAMIC_PAGE_TYPES } from "@/lib/seo/dynamic-page-types"
import type { ManagedPageSeoItem } from "@/lib/seo/types"

/**
 * Every managed page for the admin SEO reference panel. Values come from code defaults in
 * `lib/seo/managed-pages.ts` and `lib/seo/dynamic-page-types.ts`.
 */
export function listManagedPageSeoReference(): ManagedPageSeoItem[] {
  const pageItems: ManagedPageSeoItem[] = MANAGED_PAGES.map((page) => ({
    key: page.key,
    group: page.group,
    label: page.label,
    note: page.note,
    variationOf: page.variationOf,
    defaults: page.defaults,
    kind: "page" as const,
  }))

  const dynamicItems: ManagedPageSeoItem[] = DYNAMIC_PAGE_TYPES.map((type) => ({
    key: type.key,
    group: "dynamic" as const,
    label: type.label,
    note: type.note,
    defaults: {
      title: type.defaultTitleTemplate,
      description: type.defaultDescriptionTemplate,
      path: type.samplePath,
      openGraphType: "website" as const,
      robotsIndex: true,
      robotsFollow: true,
    },
    kind: "dynamic" as const,
    templateVars: type.variables.map((v) => ({ token: v.token, label: v.label, sample: v.sample })),
  }))

  return [...pageItems, ...dynamicItems]
}
