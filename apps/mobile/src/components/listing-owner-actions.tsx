import { useRouter } from "expo-router"
import { useState } from "react"
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileListingDetail } from "@reswell/api-contract"
import { EndListingSheet } from "@/components/end-listing-sheet"
import { endListing, fetchListing, markListingSold, setListingVacation } from "@/lib/api"
import { useAuthGate } from "@/lib/auth-gate"
import { fontFamily, useReswellColors } from "@/theme"

export function ListingOwnerActions({
  listing,
  onChange,
}: {
  listing: MobileListingDetail
  onChange: (next: MobileListingDetail) => void
}) {
  const colors = useReswellColors()
  const router = useRouter()
  const { requestAuth } = useAuthGate()
  const owner = listing.owner
  const [endOpen, setEndOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  if (!owner) return null

  function runAuthed(task: (accessToken: string) => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      requestAuth((accessToken) => {
        setBusy(true)
        setNotice(null)
        void task(accessToken)
          .then(resolve)
          .catch((cause: unknown) => {
            const message = cause instanceof Error ? cause.message : "Could not save that change"
            setNotice(message)
            reject(cause instanceof Error ? cause : new Error(message))
          })
          .finally(() => setBusy(false))
      })
    })
  }

  async function reloadListing(accessToken: string) {
    const next = await fetchListing(listing.id, accessToken)
    onChange(next)
  }

  function confirmMarkSold(): Promise<void> {
    return new Promise((resolve, reject) => {
      Alert.alert("Mark as sold?", "The listing will show as sold and leave your active inventory.", [
        { text: "Cancel", style: "cancel", onPress: () => reject(new Error("Cancelled")) },
        {
          text: "Mark sold",
          onPress: () =>
            void runAuthed(async (accessToken) => {
              await markListingSold(accessToken, listing.id)
              await reloadListing(accessToken)
            }).then(resolve, reject),
        },
      ])
    })
  }

  function confirmDelete(): Promise<void> {
    return new Promise((resolve, reject) => {
      Alert.alert(
        "Delete listing?",
        "This permanently removes the listing. This cannot be undone.",
        [
          { text: "Cancel", style: "cancel", onPress: () => reject(new Error("Cancelled")) },
          {
            text: "Delete",
            style: "destructive",
            onPress: () =>
              void runAuthed(async (accessToken) => {
                await endListing(accessToken, listing.id)
                router.replace("/account/listings")
              }).then(resolve, reject),
          },
        ],
      )
    })
  }

  return (
    <>
      <View style={[styles.bar, { borderBottomColor: colors.border }]}>
        {notice ? <Text style={[styles.notice, { color: colors.destructive, fontFamily: fontFamily.text }]}>{notice}</Text> : null}
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit listing"
            disabled={busy}
            onPress={() => router.push({ pathname: "/listing/edit/[id]", params: { id: listing.id } })}
            style={[styles.bubble, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.bubbleLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>Edit</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="End listing"
            disabled={busy}
            onPress={() => setEndOpen(true)}
            style={[styles.bubble, { borderColor: colors.border, backgroundColor: colors.background, borderWidth: 1 }]}
          >
            {busy ? (
              <ActivityIndicator color={colors.foreground} />
            ) : (
              <Text style={[styles.bubbleLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Delete</Text>
            )}
          </Pressable>
        </View>
      </View>
      <EndListingSheet
        visible={endOpen}
        onClose={() => setEndOpen(false)}
        listingStatus={listing.status}
        canDelete={owner.can_delete}
        vacationMode={owner.on_vacation}
        onVacation={() =>
          runAuthed(async (accessToken) => {
            await setListingVacation(accessToken, { listing_id: listing.id, enabled: !owner.on_vacation })
            await reloadListing(accessToken)
          })
        }
        onMarkSold={() => confirmMarkSold()}
        onDelete={() => confirmDelete()}
      />
    </>
  )
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  bubble: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  bubbleLabel: { fontSize: 16, fontWeight: "700" },
  notice: { fontSize: 14 },
})
