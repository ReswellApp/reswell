import { StyleSheet, Text, View } from "react-native"
import { DashboardPageGate } from "@/components/dashboard-page-gate"
import { fontFamily, useReswellColors } from "@/theme"

export default function AccountEarningsScreen() {
  const colors = useReswellColors()
  return (
    <DashboardPageGate id="earnings" title="Earnings">
      {(dashboard) => (
        <View style={styles.list}>
          <Text style={[styles.amount, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            {dashboard.wallet_balance_label}
          </Text>
          <Text style={[styles.caption, { color: colors.muted, fontFamily: fontFamily.text }]}>Wallet balance</Text>
          <Text style={[styles.lifetime, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {dashboard.earnings_lifetime_label} lifetime earnings
          </Text>
        </View>
      )}
    </DashboardPageGate>
  )
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 6 },
  amount: { fontSize: 36, fontWeight: "700" },
  caption: { fontSize: 15 },
  lifetime: { fontSize: 16, marginTop: 16 },
})
