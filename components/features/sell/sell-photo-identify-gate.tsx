"use client"

import dynamic from "next/dynamic"

const SellPhotoIdentify = dynamic(
  () => import("./sell-photo-identify").then((mod) => mod.SellPhotoIdentify),
  { loading: () => null },
)

/** Loaded only when the server has already confirmed the viewer is an admin. */
export function SellPhotoIdentifyGate() {
  return <SellPhotoIdentify />
}
