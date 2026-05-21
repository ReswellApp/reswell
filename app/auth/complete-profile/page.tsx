import { Suspense } from "react"
import { CompleteProfilePagePanel } from "@/components/auth/complete-profile-page-panel"

export default function CompleteProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh w-full items-center justify-center p-6" aria-hidden />
      }
    >
      <CompleteProfilePagePanel />
    </Suspense>
  )
}
