import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Blog — Reswell",
  description: "The Reswell blog is not published here — redirecting to the homepage.",
  path: "/blog",
})

export default function BlogPage() {
  redirect("/")
}
