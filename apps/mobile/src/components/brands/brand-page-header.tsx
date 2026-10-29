import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SymbolView } from "expo-symbols"
import type { MobileBrandModelCard, MobileBrandPage } from "@reswell/api-contract"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { BrandModelTile } from "@/components/brands/brand-model-tile"
import { HorizontalRail, SCREEN_GUTTER } from "@/components/horizontal-rail"
import { ProfileSegmentTabs } from "@/components/profile-segment-tabs"
import { fontFamily, useReswellColors } from "@/theme"

const STORY_PREVIEW = 180

export function BrandPageHeader({
  brand,
  tab,
  onTab,
  onOpenModel,
}: {
  brand: MobileBrandPage
  tab: "listings" | "sold"
  onTab: (tab: "listings" | "sold") => void
  onOpenModel: (model: MobileBrandModelCard) => void
}) {
  const colors = useReswellColors()
  const [storyOpen, setStoryOpen] = useState(false)
  const story = brand.short_description?.trim() || ""
  const storyLong = story.length > STORY_PREVIEW
  const storyText = storyOpen || !storyLong ? story : `${story.slice(0, STORY_PREVIEW).trimEnd()}…`
  const people = [
    brand.lead_shaper_name ? { label: "Shaped by", value: brand.lead_shaper_name } : null,
    brand.founder_name ? { label: "Founded by", value: brand.founder_name } : null,
  ].filter((entry): entry is { label: string; value: string } => entry != null)
  const listingCount = tab === "sold" ? brand.sold_listings.length : brand.listings.length

  return (
    <View style={styles.wrap}>
      <View style={styles.intro}>
        <View style={styles.titleRow}>
          <BrandLogoMark name={brand.name} logoUrl={brand.logo_url} size={72} radius={18} />
          <View style={styles.titleCopy}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
              {brand.name}
            </Text>
            {brand.location_label ? (
              <View style={styles.locationRow}>
                <SymbolView
                  name={{ ios: "mappin", android: "place", web: "place" }}
                  size={13}
                  tintColor={colors.muted}
                />
                <Text style={[styles.location, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  {brand.location_label}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {people.length > 0 ? (
          <View style={styles.people}>
            {people.map((entry) => (
              <Text key={entry.label} style={[styles.person, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {entry.label}{" "}
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>{entry.value}</Text>
              </Text>
            ))}
          </View>
        ) : null}

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
      </View>

      {brand.models.length > 0 ? (
        <View style={styles.models}>
          <View style={styles.sectionHead}>
            <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Models</Text>
            <Text style={[styles.sectionMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>
              {brand.models.length === 1 ? "1 model" : `${brand.models.length.toLocaleString("en-US")} models`} in the{" "}
              {brand.name} catalog
            </Text>
          </View>
          <HorizontalRail>
            {brand.models.map((model) => (
              <BrandModelTile
                key={model.id}
                name={model.name}
                categoryLabel={model.category_label}
                imageUrl={model.image_url}
                brandName={brand.name}
                brandLogoUrl={brand.logo_url}
                onPress={() => onOpenModel(model)}
              />
            ))}
          </HorizontalRail>
        </View>
      ) : null}

      <View style={styles.market}>
        <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Marketplace</Text>
        <ProfileSegmentTabs
          tabs={[
            { id: "listings", label: "For sale" },
            { id: "sold", label: "Sold" },
          ]}
          active={tab}
          onChange={onTab}
        />
        <Text style={[styles.count, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {listingCount} {listingCount === 1 ? "result" : "results"}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 8, paddingBottom: 4, gap: 22 },
  intro: { paddingHorizontal: SCREEN_GUTTER, gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  titleCopy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5, lineHeight: 32 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  location: { flex: 1, fontSize: 14, fontWeight: "600" },
  people: { gap: 4 },
  person: { fontSize: 14, lineHeight: 20 },
  story: { gap: 6 },
  body: { fontSize: 15, lineHeight: 22 },
  more: { fontSize: 14, fontWeight: "700" },
  models: { gap: 12 },
  sectionHead: { paddingHorizontal: SCREEN_GUTTER, gap: 2 },
  section: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  sectionMeta: { fontSize: 13, lineHeight: 18 },
  market: { paddingHorizontal: SCREEN_GUTTER, gap: 12, paddingTop: 4 },
  count: { fontSize: 14 },
})
