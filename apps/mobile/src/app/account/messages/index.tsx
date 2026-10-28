import { Redirect } from "expo-router"

/** Me → Messages opens the inbox on the Messages tab. Threads stay at `/account/messages/[id]`. */
export default function MessagesScreen() {
  return <Redirect href={{ pathname: "/inbox", params: { filter: "messages" } }} />
}
