import { StyleSheet, Text, View } from "react-native"

/** Stylized carrier marks for shipping UI (brand colors; not official assets). */
export function UpsCarrierMark() {
  return (
    <View style={[styles.mark, styles.ups]} accessibilityElementsHidden>
      <Text style={[styles.markText, styles.upsText]}>UPS</Text>
    </View>
  )
}

export function UspsCarrierMark() {
  return (
    <View style={[styles.mark, styles.usps]} accessibilityElementsHidden>
      <Text style={[styles.markText, styles.uspsText]}>USPS</Text>
    </View>
  )
}

export function FedExCarrierMark() {
  return (
    <View style={styles.fedexWrap} accessibilityElementsHidden>
      <View style={[styles.fedexPart, styles.fedexFed]}>
        <Text style={styles.fedexText}>Fed</Text>
      </View>
      <View style={[styles.fedexPart, styles.fedexEx]}>
        <Text style={styles.fedexText}>Ex</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  mark: {
    height: 36,
    minWidth: 52,
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  ups: { backgroundColor: "#351C15" },
  upsText: { color: "#FFB500" },
  usps: { backgroundColor: "#333366" },
  uspsText: { color: "#FFFFFF" },
  fedexWrap: { flexDirection: "row", height: 36, borderRadius: 8, overflow: "hidden" },
  fedexPart: { paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  fedexFed: { backgroundColor: "#4D148C" },
  fedexEx: { backgroundColor: "#FF6600" },
  fedexText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
})
