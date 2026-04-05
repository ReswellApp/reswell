-- Surfboard brand profiles (public catalog). Replaces file-based index directory.

CREATE TABLE IF NOT EXISTS public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  short_description text,
  website_url text,
  logo_url text,
  founder_name text,
  lead_shaper_name text,
  location_label text,
  model_count integer NOT NULL DEFAULT 0,
  about_paragraphs text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brands_slug_idx ON public.brands (slug);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brands_select_public" ON public.brands;
CREATE POLICY "brands_select_public" ON public.brands FOR SELECT USING (true);

-- Seed (migrated from legacy JSON; edit in Supabase as needed)
INSERT INTO public.brands (slug, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs) VALUES (
  'album-surf',
  'Album Surf',
  'Custom boards from Matt Parker — performance twins, asymmetrics, fish, and mid-lengths from San Clemente.',
  'https://albumsurf.com',
  'https://albumsurf.com/cdn/shop/files/Album-Logo-small_220x.png?v=1613776528',
  'Matt Parker',
  'Matt Parker',
  'San Clemente, California',
  24,
  ARRAY['Album Surf is a Southern California surfboard brand known for innovative shapes — from the Twinsman and Plasmic to asymmetrical designs like the Disorder.','Led by shaper Matt Parker, Album builds boards that emphasize speed, flow, and real-world usability, often developed with team riders and collaborators such as Asher Pacey, Victor Bernardo, and Jack Freestone.']::text[]
);
INSERT INTO public.brands (slug, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs) VALUES (
  'bing-surfboards',
  'Bing Surfboards',
  'Classic California longboards and noseriders from Encinitas — shaped by Matt Calvani with decades of Bing heritage.',
  'https://bingsurf.com',
  'https://bingsurf.com/cdn/shop/files/bing-surfboards-logo_87cc03af-4e3f-4034-a036-03fb3a23dcca_1200x1200.png?v=1613158442',
  'Bing Copeland',
  'Matt Calvani',
  'Encinitas, California',
  66,
  ARRAY['Bing Surfboards is one of California’s most storied longboard labels, known for noseriders like the Continental, versatile logs, and refined outlines rooted in Malibu and North County shaping tradition.','Today’s Bing lineup — developed with shaper Matt Calvani — spans classic noseriders, pig-inspired models, and performance-oriented longboards, with detailed stock sizing and custom options direct from the factory.']::text[]
);
INSERT INTO public.brands (slug, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs) VALUES (
  'channel-islands-surfboards',
  'Channel Islands Surfboards',
  'Performance surfboards from Santa Barbara since 1969 — Al Merrick, Britt Merrick, and the CI team.',
  'https://cisurfboards.com/pages/about',
  'https://cisurfboards.com/cdn/shop/files/The-Solution-Top-and-Bottom.png',
  'Al Merrick',
  'Britt Merrick',
  'Santa Barbara, California',
  62,
  ARRAY['Since 1969, Channel Islands Surfboards has been dedicated to performance and quality through hard work, innovation, and originality. Over the last 50 years, Channel Islands has grown from a local grass-roots operation to a cutting edge organization, catering to the best surfers in the world. It started with hard-core surfing and quality in mind and these guidelines have brought us through four decades of constant change in the surf industry. Channel Islands will shape the new millennium with innovative design and quality as our main focus.','"The driving force behind Channel Islands Surfboards is the demand on design created by the world''s greatest surfers, allowing for the highest performance surfing possible. To provide the most dedicated surfers with the most advanced, performance designs is my passion" - Al Merrick, Designer/Shaper','CI is a privately held organization focused on rider-driven product and manufacturing the best possible equipment available. Located in a state-of-the-art facility just blocks from Rincon Del Mar, the CI HQ represents a foundation for developing, testing, and building boards while providing jobs in Santa Barbara for many years to come.','Channel Islands Surfboards was created by Al and Terry Merrick in 1969. From his birth, Britt spent his days in the factory by the beach in Santa Barbara, from toddling around blanks to sweeping out shaping rooms. Eventually he started shaping alongside his father Al in 1990. He is now the lead shaper and designer for CI and carries on the family tradition of developing high performance board designs collaborating with the world''s greatest surfers. From Tom Curren, to Dane Reynolds, Channel Islands continues to evolve with the highest standard of surfing.']::text[]
);
INSERT INTO public.brands (slug, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs) VALUES (
  'chilli-surfboards',
  'Chilli Surfboards',
  'Performance and everyday shortboards from Chilli — crafted in Australia with models for groms, small-wave grovelers, and serious waves.',
  'https://www.chillisurfboards.com',
  'https://www.chillisurfboards.com/images/chilli_black.png',
  'James Cheyne',
  'James Cheyne',
  'Perth, Western Australia',
  40,
  ARRAY['Chilli Surfboards is an Australian label known for versatile shortboard and hybrid designs, from youth-focused lines to world-tour shapes trusted in quality surf.','Each model ships with detailed stock dimensions, fin recommendations, and construction options — reflected here from Chilli’s product catalog.']::text[]
);
INSERT INTO public.brands (slug, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs) VALUES (
  'dhd-surfboards',
  'DHD Surfboards',
  'Darren Handley Designs — high-performance boards from Burleigh.',
  'https://dhdsurf.com',
  'https://cdn.shopify.com/s/files/1/0242/3305/0167/t/7/assets/f5efe802a4cc--DHD-MF-BOLT-PU-YELLOW-BTM-Custom.png?v=1762397975',
  'Darren Handley',
  'Darren Handley',
  'Burleigh, Queensland, Australia',
  29,
  ARRAY['DHD (Darren Handley Designs) Surfboards is an Australian high-performance surfboard brand.','Known for team-driven R&D and World Tour–proven templates, DHD builds boards for everyday surfers and elite competitors alike.']::text[]
);
INSERT INTO public.brands (slug, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs) VALUES (
  'hayden-shapes',
  'Hayden Shapes',
  'FutureFlex performance surfboards from Sydney.',
  'https://www.haydenshapes.com',
  'https://www.haydenshapes.com/cdn/shop/files/3_6_640x.jpg?v=1754878168',
  'Hayden Cox',
  'Hayden Cox',
  'Sydney, Australia',
  51,
  ARRAY['Haydenshapes is a performance surfboard brand founded by Hayden Cox in Sydney, Australia.','Our patented parabolic carbon fiber frame construction is called FutureFlex.']::text[]
);
INSERT INTO public.brands (slug, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs) VALUES (
  'js-surfboards',
  'JS Surfboards',
  'High-performance boards from Jason Stevenson''s JS Industries.',
  'https://us.jsindustries.com',
  'https://us.jsindustries.com/cdn/shop/files/bull-run-softboard-storm.jpg?v=1763605455&width=640',
  'Jason Stevenson',
  'Jason Stevenson',
  'Gold Coast, Australia',
  25,
  ARRAY['JS Industries is a high-performance surfboard brand founded and shaped by Jason Stevenson on Australia''s Gold Coast.','Known for team-driven R&D and constructions from PU to softboards, JS boards are ridden worldwide in competition and everyday sessions.']::text[]
);
INSERT INTO public.brands (slug, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs) VALUES (
  'lost-surfboards',
  'Lost Surfboards',
  'Performance surfboards handcrafted since 1985',
  'https://lostsurfboards.net',
  'https://lostsurfboards.net/wp-content/uploads/2026/03/twinzer_logo.jpg',
  'Matt "Mayhem" Biolos',
  'Matt "Mayhem" Biolos',
  'San Clemente, California',
  77,
  ARRAY['Lost Surfboards is a performance surfboard brand known for retro-inspired shapes.','Founded by Matt "Mayhem" Biolos in 1985, the lineup spans multiple series built for real-world surfing.']::text[]
);
INSERT INTO public.brands (slug, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs) VALUES (
  'lovelace-machine',
  'Lovelace Machine',
  'Hand-shaped designs by Ryan Lovelace — Lovemachine surfboards from Carpinteria, blending craft, scanning, and thoughtful production.',
  'https://lovemachinesurfboards.com',
  'https://lovemachinesurfboards.com/cdn/shop/files/image3.jpg?v=1710804161&width=800',
  'Ryan Lovelace',
  'Ryan Lovelace',
  'Carpinteria, California',
  6,
  ARRAY['Lovemachine Surfboards is Ryan Lovelace''s California-based label — known for distinctive outlines, experimental templates, and a transparent take on how boards are designed and built.','Technology achieves some things very well, and removes too much of the human element of others. In the context of surfing and Lovemachine, the replication of specific surfboards and the ability to re-make them with reliability is a chosen focal point — a way to use technology in service of surf culture and tradition.','Hand shaping means creative freedom and the chance to express years of experience in a board for one person; using modern tools to replicate select favorites lets Lovemachine recreate those designs under one umbrella, worldwide.','The quiver is built around meaningful variation: what works on an 8''6 is not always what works on a 6''6, even under the same model name — so outlines, rocker, thickness, and rails can shift by size with intent rather than blind scaling.','500 Maple St, Ste 5, Carpinteria — with roots across the USA, Australia, Europe, and Japan through regional Lovemachine operations.']::text[]
);
INSERT INTO public.brands (slug, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs) VALUES (
  'pyzel-surfboards',
  'Pyzel Surfboards',
  'North Shore performance surfboards from Jon Pyzel — longtime shaper for John John Florence and a global staple in high-performance shortboards and step-ups.',
  'https://pyzelsurfboards.com',
  'https://pyzelsurfboards.com/cdn/shop/files/logo_1.png?v=1708989668',
  'Jon Pyzel',
  'Jon Pyzel',
  'Waialua, Hawaii',
  40,
  ARRAY['Pyzel Surfboards builds high-performance boards on Oahu’s North Shore, blending contest-driven refinement with shapes that work in everything from everyday beach breaks to heavy water.','Best known for models like the Ghost, Phantom, and Shadow alongside team-driven R&D with John John Florence, Pyzel offers detailed stock dimension tables across standard, XL, and pro sizing.']::text[]
);
INSERT INTO public.brands (slug, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs) VALUES (
  'roberts-surfboards',
  'Roberts Surfboards',
  'Pat Roberts’ California shapes — from White Diamond grovelers and Diamond family twins to performance everyday boards trusted from Ventura to worldwide lineups.',
  'https://www.robertssurf.com',
  'https://www.robertssurf.com/uploads/1/0/6/3/10638997/rwsd-logo-footer-148x78-v2_orig.png',
  'Pat Roberts',
  'Pat Roberts',
  'Ventura, California',
  67,
  ARRAY['Roberts Surfboards builds versatile shortboards and hybrids from Ventura — known for the White Diamond and a full quiver of small-wave, mid-length, and high-performance templates.','Specs and sizing follow each model’s public product pages on Roberts’ site.']::text[]
);
INSERT INTO public.brands (slug, name, short_description, website_url, logo_url, founder_name, lead_shaper_name, location_label, model_count, about_paragraphs) VALUES (
  'sharpeye-surfboards',
  'Sharp Eye Surfboards',
  'San Diego performance shortboards since 1992 — Marcio Zouvi and the SharpEye team, trusted by world-tour surfers.',
  'https://sharpeyesurfboards.com',
  'https://sharpeyesurfboards.com/cdn/shop/files/SharpEye_Logo_475d5082-8d0c-40a7-a6d0-ea96766165b4.png?v=1&width=800',
  'Marcio Zouvi',
  'Marcio Zouvi',
  'San Diego, California',
  43,
  ARRAY['SharpEye''s head shaper Marcio Zouvi began his shaping career in the late 1980s with Californian influences including Rusty, Linden, and Al Merrick. Born and raised in Rio de Janeiro, Brazil, he founded Sharp Eye Surfboards in 1992. With decades of experience he is known as a meticulous craftsman — details matter, and the brand''s promise is Zero Compromise on service and quality.','SharpEye Surfboards is built around high-performance shortboards for progressive surfing — designs that help everyday surfers and the world''s best push what''s possible in the water.','Boards are made in the USA from premium materials, with stock PU/PE lamination plus EPS/epoxy and carbon/epoxy options on many models. Headquarters: 3351 Hancock St, San Diego, CA 92110.']::text[]
);
