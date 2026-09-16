import type { DropoffBoxRule } from "./dropoff-location-box-rules.ts"

/** Active dropoff site shown on `/sell/boards`. */
export type PublicDropoffLocation = {
  id: string
  slug: string
  name: string
  city: string
  state: string
  hoursNote: string | null
  boxRules: DropoffBoxRule[]
}
