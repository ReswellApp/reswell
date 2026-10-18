import { redirect } from "next/navigation"

/** Surfboard giveaway is closed. Old links leave the raffle page. */
export default function GiveawayDetailPage() {
  redirect("/")
}
