import { useState } from "react"
import { Image } from "expo-image"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SymbolView } from "expo-symbols"
import type { MobileModelPage } from "@reswell/api-contract"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { CatalogStars } from "@/components/brands/catalog-stars"
import { ModelPriceGuide } from "@/components/brands/model-price-guide"
import { ProfileSegmentTabs } from "@/components/profile-segment-tabs"
import { SCREEN_GUTTER } from "@/components/screen-shell"
import { fontFamily, useReswellColors } from "@/theme"

const STORY_PREVIEW = 200

export type ModelCatalogTab = "listings" | "sold" | "reviews"

export function ModelPageHeader({
  page,
  tab,
  onTab,
  onBrand,
}: {
  page: MobileModelPage
  tab: ModelCatalogTab
  onTab: (tab: ModelCatalogTab) => void
  onBrand: () => void
}) {
  const colors = useReswellColors()
  const [storyOpen, setStoryOpen] = useState(false)
  const story = page.description?.trim() || ""
  const storyLong = story.length > STORY_PREVIEW
  const storyText = storyOpen || !storyLong ? story : `${story.slice(0, STORY_PREVIEW).trimEnd()}…`
  const listingCount = tab === "sold" ? page.sold_listings.length : page.listings.length
  const range = page.price_guide?.range_label
  const tabs: { id: ModelCatalogTab; label: string }[] = [
    { id: "listings", label: "For sale" },
    { id: "sold", label: "Sold" },
  ]
  if (page.review_count > 0) tabs.push({ id: "reviews", label: "Reviews" })

  return (
    <View style={styles.wrap}>
      <View style={styles.heroRow}>
        <View style={[styles.hero, { backgroundColor: colors.image }]}>
          {page.hero_image_url ? (
            <Image
              source={{ uri: page.hero_image_url }}
              style={styles.heroPhoto}
              contentFit="contain"
              accessibilityLabel={`${page.brand_name} ${page.name}`}
            />
          ) : (
            <BrandLogoMark name={page.brand_name} logoUrl={page.brand_logo_url} size={64} radius={16} decorative />
          )}
        </View>

        <View style={styles.identity}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${page.brand_name} brand`}
            onPress={onBrand}
            style={({ pressed }) => [styles.brandRow, pressed ? { opacity: 0.7 } : null]}
          >
            <BrandLogoMark name={page.brand_name} logoUrl={page.brand_logo_url} size={22} radius={6} decorative />
            <Text numberOfLines={1} style={[styles.brandName, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {page.brand_name}
            </Text>
            <SymbolView
              name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
              size={11}
              tintColor={colors.muted}
            />
          </Pressable>

          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{page.name}</Text>
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{page.category_label}</Text>

          {page.review_count > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${page.review_average.toFixed(1)} out of 5, ${page.review_count} reviews`}
              onPress={() => onTab("reviews")}
              style={({ pressed }) => [styles.rating, pressed ? { opacity: 0.7 } : null]}
            >
              <CatalogStars value={page.review_average} />
              <Text style={[styles.ratingLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {page.review_average.toFixed(1)} ({page.review_count})
              </Text>
            </Pressable>
          ) : null}

          {range ? (
            <Text style={[styles.range, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{range}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.intro}>
        {story ? (
          <View style={styles.story}>
            <Text style={[styles.body, { color: colors.foreground, fontFamily: fontFamily.text }]}>{storyText}</Text>
            {storyLong ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setStoryOpen((open) => !open)}
                hitSlop={8}
                style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
              >
                <Text style={[styles.more, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                  {storyOpen ? "Show less" : "Read more"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {page.variants.length > 0 ? (
          <View style={styles.chips}>
            {page.variants.map((variant) => (
              <View key={variant.id} style={[styles.chip, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.chipLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                  {variant.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <ModelPriceGuide page={page} />
      </View>

      <View style={styles.market}>
        <ProfileSegmentTabs tabs={tabs} active={tab} onChange={onTab} />
        {tab !== "reviews" ? (
          <Text style={[styles.count, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {listingCount} {listingCount === 1 ? "result" : "results"}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 12, paddingBottom: 4, gap: 16 },
  heroRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14,
    paddingHorizontal: SCREEN_GUTTER,
  },
  hero: {
    width: 132,
    aspectRatio: 4 / 5,
    borderRadius: 16,
    borderCurve: "continuous",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  heroPhoto: { width: "88%", height: "88%" },
  identity: { flex: 1, minWidth: 0, justifyContent: "center", gap: 6 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", maxWidth: "100%" },
  brandName: { flexShrink: 1, fontSize: 14, fontWeight: "700" },
  title: { fontSize: 24, fontWeight: "700", letterSpacing: -0.45, lineHeight: 28 },
  meta: { fontSize: 13, fontWeight: "600" },
  rating: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingLabel: { fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
  range: { fontSize: 20, fontWeight: "700", letterSpacing: -0.4, fontVariant: ["tabular-nums"], marginTop: 2 },
  intro: { paddingHorizontal: SCREEN_GUTTER, gap: 12 },
  story: { gap: 6 },
  body: { fontSize: 15, lineHeight: 22 },
  more: { fontSize: 14, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipLabel: { fontSize: 12, fontWeight: "600" },
  market: { paddingHorizontal: SCREEN_GUTTER, gap: 12, paddingTop: 4 },
  count: { fontSize: 14 },
})
