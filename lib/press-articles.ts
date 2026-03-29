export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "pullquote"; text: string; attribution?: string }
  | { type: "byline"; writer: string; photographer?: string }
  | { type: "photo-grid"; images: { url: string; caption?: string }[] }
  | { type: "heading"; text: string }
  | { type: "milestone-list"; items: { title: string; period: string; description: string }[] }
  | {
      type: "key-facts"
      facts: { label: string; value: string }[]
      films: { title: string; year: number; significance: string }[]
      awards: string[]
    }

export interface PressArticle {
  slug: string
  title: string
  excerpt: string
  publishedDate: string
  author: string
  sourceLabel: string
  sourceUrl: string
  heroImage: string
  content: ContentBlock[]
}

export const pressArticles: PressArticle[] = [
  {
    slug: "wave-riders",
    title: "Wave Riders",
    excerpt:
      "Wayne Babcock has hundreds of surfboards in his collection representing the span of design evolution, from the earliest Hawaiian alaias to today's high-performance boards.",
    publishedDate: "August 2024",
    author: "Christian Beamish",
    sourceLabel: "Santa Barbara Magazine",
    sourceUrl: "https://sbmag.com/weliveinparadise/wave-riders",
    heroImage:
      "https://images.squarespace-cdn.com/content/v1/5ffbf71557f982023c822b7b/1722979309976-J3E954G0UK7IFME1YMSL/20240416_SHOT_1_00167.jpg",
    content: [
      {
        type: "byline",
        writer: "Christian Beamish",
        photographer: "Dewey Nicks",
      },
      {
        type: "paragraph",
        text: "Wayne Babcock has hundreds of surfboards in his collection representing the span of design evolution, from the earliest Hawaiian alaias to today's high-performance boards. Outside his storage and display space on a ranch in Carpinteria, he keeps an array of early 20th-century boards called kook-boxes, designed by surfer Tom Blake and inspired by ancient olos, the 14- to 16-foot solid koa-wood surfboards of Hawaiian royalty.",
      },
      {
        type: "paragraph",
        text: "Surfboards embody the cultural mores of their time; the chemical composites of today no less than the great olos of Hawaiian chieftains, selected from sacred forests. But what thread links the cultures of the Polynesian voyagers and the surfers of today? As the holder of one of the preeminent collections of surfboards — a grouping that includes boards that date to Hawaiian royalty and contemporary world champions — Wayne Babcock is uniquely positioned to answer that question. \"It's all connected,\" he says, by \"the same beautiful act of riding a wave and playing in nature.\"",
      },
      {
        type: "photo-grid",
        images: [
          {
            url: "https://images.squarespace-cdn.com/content/v1/5ffbf71557f982023c822b7b/1722979309054-O9NPEPE776T39AQT8UGS/20240416_SHOT_1_00058.jpg",
          },
          {
            url: "https://images.squarespace-cdn.com/content/v1/5ffbf71557f982023c822b7b/1722979309053-BUVEUVTGJ8S7VZXLY84N/20240416_SHOT_1_00044.jpg",
          },
        ],
      },
      {
        type: "paragraph",
        text: "Born in Los Angeles in 1958, Babcock describes his childhood wonderment at the butterflies and flowers that, for him, represented the real magic of the universe. This notion of magic, or at least of a grander scheme at work, continues to inform his view of the world. \"It's funny how the universe works with me,\" he says. The historic surfboards that are his passion seem to come to him, he adds. \"They manifest.\"",
      },
      {
        type: "paragraph",
        text: "Babcock's long-running connection to Carpinteria includes a deep appreciation for the Channel Islands surfboard label, started by Al Merrick in Santa Barbara in the 1970s.",
      },
      {
        type: "pullquote",
        text: "Surf aficionados and collectors are a rare breed. Probably the most knowledgeable and prolific collector is Wayne Babcock. He has, arguably, the best collection in the U.S., if not the world.",
        attribution: "Randy Rarick",
      },
      {
        type: "paragraph",
        text: "Randy Rarick, who runs classic surfboard auctions and does restoration work on boards, says Babcock stands apart from the field. But it's not as though Babcock sits around waiting for the boards to manifest. He's been a collector for a long time. His mother was a collector, and when he was young she took him to estate sales around Los Angeles, helping him develop an eye for the valuable and unusual. Babcock held a spot at the Rose Bowl Flea Market for years, adding to his trove of 20th-century ephemera, such as sunglasses, lighters, and pocket knives.",
      },
      {
        type: "paragraph",
        text: "The surfboards are his heart's delight, but Babcock pays the bills running Angels Antiques in Carpinteria, where for 40 years he has been the go-to guy for anyone looking for that special midcentury object — a chair, table, teapot, or tchotchke. Hawaiiana is another specialty; he has an encyclopedic knowledge of Hawaiian slack-key guitar players.",
      },
      {
        type: "photo-grid",
        images: [
          {
            url: "https://images.squarespace-cdn.com/content/v1/5ffbf71557f982023c822b7b/1722979312537-L3QL9OPO3ZLXPYYDJDMJ/20240416_SHOT_1_01644.jpg",
          },
          {
            url: "https://images.squarespace-cdn.com/content/v1/5ffbf71557f982023c822b7b/1722979313425-FR3BTQY2SJ35VLJJ4BMU/20240416_SHOT_2_00063.jpg",
          },
          {
            url: "https://images.squarespace-cdn.com/content/v1/5ffbf71557f982023c822b7b/1722979311845-A7B4EWCFEGZGYO231G4W/20240416_SHOT_1_01492.jpg",
          },
          {
            url: "https://images.squarespace-cdn.com/content/v1/5ffbf71557f982023c822b7b/1722979310982-VT6V8AH30C5Q5GDFN94X/20240416_SHOT_1_00669.jpg",
          },
        ],
      },
      {
        type: "paragraph",
        text: "In his flea market days, Babcock displayed a placard designed like a wanted poster from the Wild West. But instead of desperados, he was after vintage surfboards: \"Top dollar paid!\" read a graphic explosion. Rather than provide contact information on the poster, he waited for people to talk with him directly so he could gauge whether a lead was worth following.",
      },
      {
        type: "paragraph",
        text: "The older boards in the collection speak of summers long passed yet suggest the timeless joy of getting into the surf and simply riding back to shore. George Greenough, originally of Montecito but long ensconced among the glistening forests and point surf of Byron Bay in New South Wales, Australia, is surfing's patron saint of high-performance design. His experiments with kneeboards led to the shortboard revolution in 1967, forever altering the way surfers approach the waves.",
      },
      {
        type: "photo-grid",
        images: [
          {
            url: "https://images.squarespace-cdn.com/content/v1/5ffbf71557f982023c822b7b/1722979311733-B9KJC6401BJZ5P2PH6EJ/20240416_SHOT_1_01041.jpg",
          },
          {
            url: "https://images.squarespace-cdn.com/content/v1/5ffbf71557f982023c822b7b/1722979313325-P7AK1RH190U9LTP41ZFD/20240416_SHOT_1_02549.jpg",
          },
        ],
      },
      {
        type: "paragraph",
        text: "During one such conversation, a woman mentioned that her husband had a very old board. So began a series of phone calls that Babcock likens to an affair, in which she quietly kept him apprised of her spouse's willingness to let the board go. Her husband had bought it from another Angeleno who had acquired the board in the 1930s in Waikiki, the cradle of contemporary surfing. Waikiki was the stomping grounds of a cadre of Hawaiian watermen known as the Beach Boys, among them the greatest of all surfers, Duke Kahanamoku.",
      },
      {
        type: "paragraph",
        text: "It was not Duke's board, but the man in the 1930s had asked the Beach Boys — whom he presumably met through surf lessons — if he could buy the oldest surfboard they knew of. And it is the thought of distant generations of Hawaiian grandfathers riding this surfboard that fires Babcock's imagination.",
      },
      {
        type: "photo-grid",
        images: [
          {
            url: "https://images.squarespace-cdn.com/content/v1/5ffbf71557f982023c822b7b/1722979310016-TFIAK89AT30GQSYA7GF7/20240416_SHOT_1_00276.jpg",
            caption:
              "A Santa Monica boy, Wayne Babcock came up in the Dogtown era — a notorious scene embracing a radical outlook on all things involving surfing and skateboarding in the mid to late 1970s.",
          },
          {
            url: "https://images.squarespace-cdn.com/content/v1/5ffbf71557f982023c822b7b/1722979312633-6QCIUGA98OCFHXFEW9IT/20240416_SHOT_1_02334.jpg",
            caption:
              "In the 1930s, a visitor from Los Angeles asked his Hawaiian surf instructors at Waikiki if he could purchase the oldest surfboard they knew of at the time. This board, of unknown provenance, was the craft they found.",
          },
        ],
      },
      {
        type: "paragraph",
        text: "His oldest boards were shaped by master crafters who obtained the characteristics they wanted in their designs through concaves and chines, well-shaped rails, and pure, functional outlines. Ultimately, perhaps, it is the refinement of these earliest boards that connects the surfing and seafaring technologies of ancient Polynesia to those of the modern era.",
      },
      {
        type: "paragraph",
        text: "Babcock's collection comprises some 400 surfboards, many representing important shaping developments: Joe Quigg's Malibu Chip design sits on a rack above a Bob Simmons planing hull; there are Renny Yater's era-defining noseriders and his California guns of the 1970s. Dick Brewer big-wave spears share space with George Greenough's high-speed windsurfing boards. Al Merrick's shortboard precision and John Bradbury single fins attest to the lineage of Santa Barbara surfing.",
      },
      {
        type: "paragraph",
        text: "\"Carpinteria needs a surf museum,\" Babcock says. His wave-riding talismans, though well-catalogued and properly stored in a temperature-controlled container on a private ranch in Carpinteria, are not available for public viewing. He envisions a venue where these boards can inform, inspire, and help people connect to the splendor of surfing and its long history in the Pacific and around the world.",
      },
    ],
  },
  {
    slug: "brief-history-of-surfboards",
    title: "A Brief History of Surfboards",
    excerpt:
      "From ancient Peruvian reed horses to computer-generated designs — how 5,000 years of innovation shaped the board beneath your feet.",
    publishedDate: "December 2025",
    author: "Tim Barlass",
    sourceLabel: "Australian National Maritime Museum",
    sourceUrl: "https://www.sea.museum/en/society-and-water/a-brief-history-of-surfboards",
    heroImage:
      "https://cms-web.seamuseum.net/sites/default/files/styles/ultra_horizontal/public/2025-12/00046944-copy-crop-hero.jpg?itok=pEVk9GyP",
    content: [
      {
        type: "byline",
        writer: "Tim Barlass",
      },
      {
        type: "paragraph",
        text: "The date is about 3000 BC. The place, Peru. The key ingredients are totora reeds (a kind of giant bullrush), skill and courage. Bind the four-metre long reeds together and add a paddle, and you have a caballito de totora — or 'little reed horse' — a floating board. You may well have the birth of wave riding, and a precursor to surfing.",
      },
      {
        type: "pullquote",
        text: "I'm a Huanchaco fisherman, like my ancestors. My caballito de totora is my boat that provides for my livelihood and family.",
        attribution: 'Carlos "Huevito" Ucanan',
      },
      {
        type: "paragraph",
        text: 'Carlos "Huevito" Ucanan from Huanchaco, north of Lima in Peru, keeps the ancient tradition alive and has visited Australia to demonstrate the construction and his skills on the caballito at Noosa. Fast forward 3,300 years to 300 AD: in Polynesia, solid wood boards are now the wave vehicle of choice. Surfing has arrived.',
      },
      {
        type: "photo-grid",
        images: [
          {
            url: "https://www.sea.museum/_next/image?url=https%3A%2F%2Fcms-web.seamuseum.net%2Fsites%2Fdefault%2Ffiles%2Fstyles%2Funcropped%2Fpublic%2F2025-12%2Fark_70111_47fl.0-copy.jpg%3Fitok%3DRVkk1yBy&w=3840&q=75",
            caption: "Sketch of surf board riding on Sandwich Isles (later named Hawaii), artist unknown. Hawaii State Archives.",
          },
          {
            url: "https://www.sea.museum/_next/image?url=https%3A%2F%2Fcms-web.seamuseum.net%2Fsites%2Fdefault%2Ffiles%2Fstyles%2Funcropped%2Fpublic%2F2025-12%2F00046944-copy.jpg%3Fitok%3DPE-UAU2w&w=3840&q=75",
            caption: "Engraving depicting the arrival of Captain Cook's ship Resolution at Kealakekua Bay, Hawaii, in 1779. Engraver: Edmund Scott, ANMM Collection.",
          },
        ],
      },
      {
        type: "paragraph",
        text: "In the centuries before the arrival of Captain Cook in Hawaii, surfing was at the core of island culture. According to The Art of the Surfboard by Greg Noll, an American pioneer of big wave surfing, the status of an individual dictated what type of board they could use: short and wide for commoners, and long 18ft (5.5m) and narrow for the chiefs.",
      },
      {
        type: "paragraph",
        text: "Various kinds of competition were staged when the surf was running. \"The stakes could range from a pig to a wife, from a canoe to a man's life. Surfing was a joyful endeavour that could also turn deadly serious,\" writes Noll.",
      },
      {
        type: "paragraph",
        text: "Captain Cook and surfing aren't normally synonymous, but a sketch of Karakakooa Bay in Hawaii by John Webber — the official artist on Cook's third voyage to the Pacific — has an interesting detail. It depicts islanders greeting Cook's ship HMS Resolution, and in the lower left centre of the picture is an early 'surfer' paddling out to meet the ship. After Cook was killed on Hawaii, First Lieutenant James King was assigned the task of continuing Cook's journal, providing the earliest written account of surfing.",
      },
      {
        type: "pullquote",
        text: "About 20 or 30 of the islanders take each a long narrow board, rounded at both ends, and set out from the shore in company with each other... The amazing courage and address, with which they perform these dangerous manoeuvres, are almost incredible.",
        attribution: "Lt. James King, 1779",
      },
      {
        type: "photo-grid",
        images: [
          {
            url: "https://www.sea.museum/_next/image?url=https%3A%2F%2Fcms-web.seamuseum.net%2Fsites%2Fdefault%2Ffiles%2Fstyles%2Funcropped%2Fpublic%2F2025-12%2Fanms0551-046-copy_0.jpg%3Fitok%3DohidOA_i&w=3840&q=75",
            caption: "Duke Kahanamoku visited Sydney in early 1915, at the invitation of the Australian Amateur Swimming Association. ANMM Collection.",
          },
        ],
      },
      {
        type: "paragraph",
        text: "Though Australia was first introduced to surfing in the late 19th century by traders and travellers who had passed through Hawaii, the surfing demonstrations of Hawaiian Duke Kahanamoku in 1914–15 were a significant moment in Australia's surfing history. Solid hardwood planks were common on Australian beaches between World War I and World War II, and pre-dated the Australian surfing boom of the late 1950s and early 1960s.",
      },
      {
        type: "photo-grid",
        images: [
          {
            url: "https://www.sea.museum/_next/image?url=https%3A%2F%2Fcms-web.seamuseum.net%2Fsites%2Fdefault%2Ffiles%2Fstyles%2Fhorizontal%2Fpublic%2Ffotoweb%2F2025-12%2F00000716_e2.jpg%3Fitok%3DaHZGq6T6&w=3840&q=75",
            caption: "This 'Alaia' style solid board was the first type seen on Australian beaches. Made during the 1920s, the original owner Fred Notting was NSW surfboard champion in 1944 and 1945. ANMM Collection.",
          },
          {
            url: "https://www.sea.museum/_next/image?url=https%3A%2F%2Fcms-web.seamuseum.net%2Fsites%2Fdefault%2Ffiles%2Fstyles%2Fhorizontal%2Fpublic%2Ffotoweb%2F2025-12%2F1989_136_1%252000001230.jpg%3Fitok%3DqCYmx9TU&w=3840&q=75",
            caption: "Used by members of the Maroubra Surf Life Saving Club, this rare hollow board exemplifies the stylistic and technological developments in surfboard designs of the 1950s. ANMM Collection.",
          },
        ],
      },
      {
        type: "paragraph",
        text: "The end of World War II opened up new possibilities in surfboard design. Many new materials had become available through advances in technology during the war. As a result, fiberglass-coated Malibus were developed in the late 1950s, allowing surfers a greater range of manoeuvres than early wooden boards. The Malibu shape was introduced to Australia in 1956 when a group of Californian lifeguards brought new Malibu boards. Australians began experimenting with balsa, foam-and-fiberglass designs, and eventually the Malibu went into mass-production.",
      },
      {
        type: "photo-grid",
        images: [
          {
            url: "https://www.sea.museum/_next/image?url=https%3A%2F%2Fcms-web.seamuseum.net%2Fsites%2Fdefault%2Ffiles%2Fstyles%2Funcropped%2Fpublic%2Ffotoweb%2F2025-12%2F00009214_2-copy.jpg%3Fitok%3D0o7HA4Hk&w=3840&q=75",
            caption: "This balsa board was purchased for Jan Baikovas by her father in 1958, when she was 16. Made specifically lighter for her, a family friend painted the Gidget logo on it — she was the only girl surfing at the time.",
          },
          {
            url: "https://www.sea.museum/_next/image?url=https%3A%2F%2Fcms-web.seamuseum.net%2Fsites%2Fdefault%2Ffiles%2Fstyles%2Funcropped%2Fpublic%2Ffotoweb%2F2025-12%2F00009214_1.jpg%3Fitok%3DpiiXVqXG&w=3840&q=75",
            caption: "Close-up of the Gidget logo painted on the board.",
          },
        ],
      },
      {
        type: "heading",
        text: "Key Moments in Surfboard Design",
      },
      {
        type: "milestone-list",
        items: [
          {
            title: "Fiberglass Outer Shells",
            period: "1940s – 1950s",
            description:
              "The introduction of fiberglass resin laminates sealed foam cores, improving durability and allowing vibrant graphics — becoming a standard construction method.",
          },
          {
            title: 'Foam-and-Fiberglass "Sandwich" Boards',
            period: "1950",
            description:
              "Bob Simmons introduced the earliest foam-core boards (polystyrene) with fiberglass and balsa veneers, generating lighter, more maneuverable shapes.",
          },
          {
            title: "Polyurethane Foam Blanks",
            period: "1958 – 1961",
            description:
              "Hobie Alter and Gordon \"Grubby\" Clark pioneered moulded polyurethane blanks in 1958, dominating the market until 2005.",
          },
          {
            title: "Shortboard Revolution & V-Bottom",
            period: "1960s – 1970s",
            description:
              "The shift from longboards to performance-focused shortboards — with innovations like Bob McTavish's Vee-bottom — allowed sharper turns and greater responsiveness.",
          },
          {
            title: "Thruster Fin System",
            period: "1980",
            description:
              "Simon Anderson's three-fin \"thruster\" design greatly enhanced maneuverability and became the industry-standard fin setup that most boards still use today.",
          },
          {
            title: "Modern Materials & Technology",
            period: "1990s – present",
            description:
              "EPS foam with epoxy resins, carbon/Kevlar reinforcements, CNC shaping, vacuum bagging, computer-aided design, and sustainable materials now define surfboard manufacturing.",
          },
        ],
      },
    ],
  },
  {
    slug: "george-greenough-mad-scientist",
    title: "Surfing's Mad Scientist",
    excerpt:
      "A rare in-depth portrait of George Greenough — the reclusive Santa Barbara waterman whose spoon designs and laminar-flow fins quietly ignited the shortboard revolution.",
    publishedDate: "June 2021",
    author: "John Grissim",
    sourceLabel: "Shred Sledz",
    sourceUrl: "https://shredsledz.net/2021/06/george-greenough-surfings-mad-scientist/",
    heroImage:
      "https://shredsledz.net/wp-content/uploads/2021/06/george-greenough-john-grissim-1024x576.jpg",
    content: [
      {
        type: "byline",
        writer: "John Grissim",
        photographer: "John Grissim",
      },
      {
        type: "paragraph",
        text: "Excerpted from John Grissim's 1982 book \"Pure Stoke\" and republished by Henry Knapp at Shred Sledz. The sun lies low in Rincon's evening sky, saturating the view from the beach with a glare that all but obscures the surfers in the water. Conditions are typical for this classic California break: three- to four-foot sets, a slight onshore, and textured peeling rights made to order for the resident longboard specialists.",
      },
      {
        type: "paragraph",
        text: "Out near the Indicator a kneeboarder takes off on an off-size five footer, streaks to the bottom, and disappears in the trough. Two seconds later he reappears high on a long wall, tracking much faster than anything out there, then abruptly drives for the bottom as a section pitches out. In the flat well, away from the white water, the figure leans sharply into a turn, sweeps around the section, accelerating high onto a feathering wall that grows a translucent green in the setting sun. Nearing the lip, he jams hard against the face, shifts to the outside rail, and carves a huge arc, slicing thirty feet off the top of the wave, sending skyward a rainbow rooster tail of spray.",
      },
      {
        type: "paragraph",
        text: "The track on the wave and its rooster tail flourish are the signature of George Greenough, one of the world's premier watermen, wave explorers, and, in the eyes of many, surfing's mad scientist. He's not mad, of course, nor is he much given to science, at least its fastidious, academic side. Yet to see him in his workshop — barefooted, staring intently at the disemboweled movement of a war surplus camera, surrounded by machine tools, electrical gadgetry, and assorted potentially useful junk gathered over a decade of eclectic browsing — one can easily understand from whence the mad scientist reputation springs.",
      },
      {
        type: "photo-grid",
        images: [
          {
            url: "https://shredsledz.net/wp-content/uploads/2021/06/george-greenough-spoon-john-grissim-1024x639.jpg",
            caption: "Greenough with one of his famous spoon designs. Photo by John Grissim.",
          },
        ],
      },
      {
        type: "paragraph",
        text: "Not coincidentally George is one of the best and most respected surfers in the world — this despite the fact that he has never entered a surfing contest, is never seen at big-time, crowded public surf spots like Pipeline, and doesn't ride surfboards. He doesn't cultivate mystique; rather, he's simply not interested in anything that distracts him from a pursuit of the direct experience of water and waves.",
      },
      {
        type: "paragraph",
        text: "Greenough's stellar status in the surfing world derives from his pioneer experimentation with the dynamics of boards, fins, and foils, the results of which went a long way in advancing the development of modern surfboard design. His short, lightweight, dished-out kneeboards — known as spoons — with their flexible bottom configurations and high-aspect fins enabled him to crank out performances on the most powerful waves that nobody else could approach. His ability, which puts him in the ranks of the ten all-time great surfers, led to his making The Innermost Limits of Pure Fun — the first film to show wave riding from a surfer's in-the-tube perspective.",
      },
      {
        type: "pullquote",
        text: "One of the problems I think professional surfers have is they don't seem to know a whole lot about board design. I see mismatches of boards and fins that to me are pretty obvious. It's like setting up a race car. You can have it understeer or oversteer or be neutral.",
        attribution: "George Greenough",
      },
      {
        type: "paragraph",
        text: "In 1965, acting on tales of the perfect breaks of Australia's subtropical Queensland, Greenough flew to Brisbane. Two weeks later he had met Bob McTavish and was blowing minds with spectacular rides at Noosa Head — imparting fresh ideas on board design that led to the shortboard revolution. By 1970 he had perfected the high-aspect, laminar-flow fin, a development which made him literally the fastest man in the water.",
      },
      {
        type: "pullquote",
        text: "Laminar flow basically is over a very narrow range. Look at any high-performance fish — marlin, swordfish, tuna — and you'll notice their tail is very narrow and quite high. With that kind of fin, by the time the turbulence shows up in the water the fin has already left it behind. Hence no turbulence to affect performance.",
        attribution: "George Greenough",
      },
      {
        type: "paragraph",
        text: "George spent thousands of hours experimenting. Often he would tie prototype fins to a surf matt anchored to the kelp outside the surf break, enabling him to make quick fin changes during a session. The objective, naturally, was the enhancement of pure stoke.",
      },
      {
        type: "pullquote",
        text: "I was reaching for the feeling of speed, especially the high speed turn. I really get a rush off that. There's nothing I like better than just flattening it, just putting your foot to the floor and leaving it there.",
        attribution: "George Greenough",
      },
      {
        type: "paragraph",
        text: "In 1971, Greenough shot a sequence of rides using a high-speed 16mm camera mounted on specially designed brackets on the front of his spoon. The parameters were ridiculously far-fetched: the board was less than five feet long and weighed under five pounds; the camera weighed a whopping twenty-three pounds; and the wave he tackled was a big, clean, cranking classic Aussie monster — the biggest day of the year, and he was the only one out.",
      },
      {
        type: "photo-grid",
        images: [
          {
            url: "https://shredsledz.net/wp-content/uploads/2021/06/alby-fazon-george-greenough-1024x636.jpg",
            caption: "Alby Falzon filming George Greenough for Crystal Voyager. Photo by David Elfick.",
          },
        ],
      },
      {
        type: "paragraph",
        text: "The results were spectacular — a 23-minute sequence called \"Echoes\" (after a Pink Floyd track) that carries the viewer beyond the level of hoot and into a sublime realm that is spiritual as well as ecstatic. One slow-motion tube ride alone lasts 55 seconds. Debuting in 1974 at the Odeon Theatre in London's West End, the documentary Crystal Voyager became an instant cult hit, breaking the theater's previous box office record within weeks.",
      },
      {
        type: "paragraph",
        text: "George also built his own fiberglass 37-foot ketch, equipped it with a homemade wind generator, and sailed to Australia — spending nearly a year surfing unpopulated breaks in Tahitian waters en route. He successfully navigated the Pacific using a plastic sextant with lousy optics, sighting stars with the naked eye when the lens system failed after dusk. When a navy friend said it was impossible, George shrugged: \"It worked.\"",
      },
      {
        type: "pullquote",
        text: "I tend to go where the most energy is. I look for the spot with the most power and the least number of people. I don't care about shape. And bumps aren't going to worry me.",
        attribution: "George Greenough",
      },
      {
        type: "paragraph",
        text: "George's singular lifestyle is characterized by movement from project to project, with an absorption and lack of self-awareness that is in some ways innocent but certainly refreshing. In the months following Grissim's visit, Greenough completed sensational in-the-tube footage with a 35mm camera; returned to Australia to begin building a pyramid-shaped home of his own design; and discovered board sailing, immediately launching into the design and construction of high-performance graphite hulls. He also turned forty — and looked ten years younger.",
      },
      {
        type: "paragraph",
        text: "\"If there's a good twenty-five mile an hour wind roaring down the beach at Rincon tomorrow,\" he said as the evening wound down, \"I'll be stoked.\"",
      },
    ],
  },
  {
    slug: "george-greenough-most-influential",
    title: "George Greenough: Surfing's Most Influential Figure",
    excerpt:
      "Innovator, filmmaker, and architect of the shortboard revolution — how a reclusive Santa Barbara waterman quietly changed everything about the way we surf.",
    publishedDate: "March 2026",
    author: "Reswell Editorial",
    sourceLabel: "Reswell",
    sourceUrl: "https://reswell.com/collections/press/george-greenough-most-influential",
    heroImage:
      "https://shredsledz.net/wp-content/uploads/2021/06/george-greenough-spoon-john-grissim-1024x639.jpg",
    content: [
      {
        type: "pullquote",
        text: "George Greenough is the only genius we've ever had in the evolution of surfing.",
        attribution: "Nat Young, 1966 World Surfing Champion",
      },
      {
        type: "heading",
        text: "Who Is George Greenough?",
      },
      {
        type: "paragraph",
        text: "George Hamilton Perkins Greenough (born November 6, 1941, in Santa Barbara, California) is one of the most influential figures in the history of surfing. A surfer, board shaper, filmmaker, boat builder, and waterman, Greenough's far-reaching contributions to surfboard design, fin technology, and surf cinematography helped define modern surfing as we know it. Despite his enormous impact, he remained famously reclusive — preferring empty lineups, solitary surf sessions at Rincon at dusk, and life on a boat or coastal ranch in Byron Bay, Australia, where he still resides.",
      },
      {
        type: "heading",
        text: "Early Life and Character",
      },
      {
        type: "paragraph",
        text: "Growing up near an abundance of quality pointbreaks in Santa Barbara, Greenough developed an obsessive passion for the ocean from a young age. He underwent open-heart surgery at age ten, yet became known for his extraordinary physical connection to the sea. He was a genuine eccentric — often shoeless for months at a time, resin-stained, and indifferent to material wealth despite coming from an affluent family. He started shaping boards out of balsa wood in high school, began stand-up surfing in the 1950s, and by 1961 had shifted to kneeboarding and air-inflated mats, which gave him a lower center of gravity and a heightened sensation of speed.",
      },
      {
        type: "heading",
        text: "The Spoon and the High-Aspect Fin",
      },
      {
        type: "paragraph",
        text: "In 1961, Greenough created his legendary 'spoon' — a blunt-nosed balsa kneeboard, roughly 5 feet long and 23 inches wide, with a dished-out midsection and a tail that tapered to nearly half an inch in thickness. The board's flexibility mimicked the movement of a fish: 'Fish moved when they swam, so why not make a whole board that moved when it rode waves?' he explained. Equally revolutionary was his redesign of the surfboard fin. He replaced the standard 10-inch keel fin of the era with a smaller, flexible, swept-back model inspired by the rear dorsal fin of a tuna — his 'high-aspect ratio fin.' It dramatically reduced drag and transformed a surfboard's turning ability. Though it took about three years to catch on widely, this fin design became the direct ancestor of every modern surfboard fin.",
      },
      {
        type: "photo-grid",
        images: [
          {
            url: "https://shredsledz.net/wp-content/uploads/2021/06/george-greenough-spoon-john-grissim-1024x639.jpg",
            caption: "Greenough with one of his famous spoon designs. Photo by John Grissim.",
          },
        ],
      },
      {
        type: "heading",
        text: "Sparking the Shortboard Revolution",
      },
      {
        type: "paragraph",
        text: "Greenough's first trip to Australia in 1964 changed surfing history. His radical style — sharp bottom turns, deep barrel rides, and explosive directional changes — was unlike anything Australian surfers had seen on a stand-up board. He directly influenced Nat Young and shaper Bob McTavish. Young used a Greenough-foiled fin on his 9'4\" board 'Magic Sam' and won the 1966 World Surfing Championships in San Diego. McTavish, inspired by the turning mechanics of Greenough's kneeboards, developed a vee-bottom shortboard that triggered the global shortboard revolution.",
      },
      {
        type: "heading",
        text: "Pioneering Surf Cinematography",
      },
      {
        type: "paragraph",
        text: "Greenough's genius extended well beyond shaping. Obsessed with capturing the ocean's perspective from within, he built custom waterproof camera housings — including one shaped like a baby dolphin for filming underwater — and mounted cameras on surfboard noses and even his own back. In 1966, he captured the first-ever photograph of a surfer inside the barrel. His 1970 film 'The Innermost Limits of Pure Fun' introduced audiences worldwide to the first point-of-view tube rides, forever changing how surf films were made. His follow-up work 'Echoes' (1972) was so captivating that Pink Floyd donated the rights to their iconic track after seeing the footage. The film screened at the 1974 Cannes Film Festival and ran for a record-breaking six months in London's West End.",
      },
      {
        type: "photo-grid",
        images: [
          {
            url: "https://shredsledz.net/wp-content/uploads/2021/06/alby-fazon-george-greenough-1024x636.jpg",
            caption: "Alby Falzon filming George Greenough for Crystal Voyager (1973). Photo by David Elfick.",
          },
        ],
      },
      {
        type: "heading",
        text: "Legacy and Influence",
      },
      {
        type: "paragraph",
        text: "Greenough is credited with the design of the modern surfboard fin, the development of high-performance shortboard surfing, and the invention of in-the-tube cinematic perspective. His influence touched Hollywood — he was part of the camera crew on the 1978 film 'Big Wednesday' — and inspired generations of shapers, surfers, and filmmakers. Clips of his riding appeared in landmark surf films including 'The Endless Summer' (1965), 'The Hot Generation' (1968), and 'Evolution' (1969). Greenough continues to surf, innovate, and film from his base in Byron Bay, Australia — still on a mat, still shoeless, still ahead of his time.",
      },
      {
        type: "key-facts",
        facts: [
          { label: "Full Name", value: "George Hamilton Perkins Greenough" },
          { label: "Born", value: "November 6, 1941" },
          { label: "From", value: "Santa Barbara, California" },
          { label: "Based", value: "Byron Bay, NSW, Australia" },
          {
            label: "Disciplines",
            value: "Kneeboard surfing · Mat surfing · Surfboard shaping · Fin design · Surf filmmaking · Boat building",
          },
          {
            label: "Notable Inventions",
            value:
              "The 'Spoon' kneeboard (1961) · High-aspect ratio surfboard fin · Custom underwater camera housings · Back-mounted surf camera rig",
          },
        ],
        films: [
          {
            title: "The Innermost Limits of Pure Fun",
            year: 1970,
            significance: "First point-of-view tube ride footage in surf cinema",
          },
          {
            title: "Echoes",
            year: 1972,
            significance: "Paired with Pink Floyd's 'Echoes'; screened at Cannes 1974",
          },
          {
            title: "Crystal Voyager",
            year: 1973,
            significance: "Documentary on Greenough's innovations; record-breaking London run",
          },
        ],
        awards: [
          "Surfing Walk of Fame — Surf Culture (2005)",
          "Surfing Walk of Fame — Surf Pioneer (2007)",
        ],
      },
    ],
  },
]

export function getPressArticleBySlug(slug: string): PressArticle | undefined {
  return pressArticles.find((a) => a.slug === slug)
}
