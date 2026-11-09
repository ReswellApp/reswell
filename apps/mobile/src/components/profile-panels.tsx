import { SymbolView } from "expo-symbols"
import { StyleSheet, Text, View } from "react-native"
import type { MobileProfile } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function ProfileInfo({ profile }: { profile: MobileProfile }) {
  const colors = useReswellColors()
  return (
    <View style={styles.panel}>
      <View style={styles.block}>
        <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.headline }]}>About this seller</Text>
        <Text style={[styles.body, { color: profile.about ? colors.foreground : colors.muted, fontFamily: fontFamily.text }]}>
          {profile.about?.trim() || "This seller has not added a shop description yet."}
        </Text>
        {profile.location_label ? (
          <View style={styles.row}>
            <SymbolView name={{ ios: "mappin", android: "location_on", web: "location_on" }} size={16} tintColor={colors.muted} />
            <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>{profile.location_label}</Text>
          </View>
        ) : null}
        <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Member since {profile.member_since_label}
        </Text>
      </View>

      <View style={[styles.policies, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.policiesTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Buyer protection</Text>
        <Text style={[styles.policiesBody, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Purchases on Reswell are covered by buyer protection. Shipping, returns, and pickup details are set per listing.
          Message the seller with any questions before checkout.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 20 },
  block: { gap: 10 },
  heading: { fontSize: 17, fontWeight: "700", letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22 },
  meta: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  policies: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  policiesTitle: { fontSize: 14, fontWeight: "700" },
  policiesBody: { fontSize: 14, lineHeight: 20 },
})
