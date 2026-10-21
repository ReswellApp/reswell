const PACKING_VIDEOS = [
  {
    src: "https://www.youtube.com/embed/NzDaFE4d9V4?start=14",
    title: "How to pack a surfboard for shipping",
    caption: "A New Earth Project packing walkthrough.",
  },
  {
    src: "https://www.youtube.com/embed/NHXwSMfad3U",
    title: "Reswell packing video",
    caption: "Packing a board at Reswell.",
  },
] as const

export function HowToShipPackingVideos() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {PACKING_VIDEOS.map((video) => (
        <figure key={video.src}>
          <div className="overflow-hidden rounded-2xl bg-[#efece6]">
            <iframe
              src={video.src}
              title={video.title}
              className="aspect-video w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>
          <figcaption className="mt-2 text-sm leading-snug text-[#5c6b89]">{video.caption}</figcaption>
        </figure>
      ))}
    </div>
  )
}
