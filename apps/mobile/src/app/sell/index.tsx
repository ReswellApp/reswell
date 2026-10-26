import { Redirect } from "expo-router"

/** Sell tab opens the listing flow directly; keep `/sell` as a stable entry URL. */
export default function SellIndexScreen() {
  return <Redirect href="/sell/new" />
}
