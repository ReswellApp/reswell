import { Stack, useRouter } from "expo-router"
import { useEffect } from "react"

/** Legacy route — dashboard links now live on the Me tab. */
export default function AccountMenuScreen() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/account")
  }, [router])
  return <Stack.Screen options={{ title: "Dashboard" }} />
}
