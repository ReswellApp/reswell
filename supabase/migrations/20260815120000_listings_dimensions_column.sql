-- Single surfboard dimensions string on listings; migrate from legacy columns.
-- Order-safe: if numeric columns were already dropped (e.g. 20260816120000 ran first), only
-- display text and foot-mark length patterns are used for backfill.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS dimensions text;

COMMENT ON COLUMN public.listings.dimensions IS
  'Board dims in one string: (length width thickness volumeL), e.g. (5''11 18 3/8 2 1/4 27L).';

DO $$
BEGIN
  -- Path A: numeric columns still present — full backfill from numerics + display fallbacks.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'length_feet'
  ) THEN
    EXECUTE $sql$
      WITH parts AS (
        SELECT
          id,
          CASE
            WHEN length_feet IS NOT NULL THEN
              concat(
                length_feet::text,
                chr(39),
                COALESCE(
                  NULLIF(trim(length_inches_display), ''),
                  CASE
                    WHEN length_inches IS NOT NULL
                      AND length_inches::double precision IS DISTINCT FROM 0::double precision
                    THEN
                      regexp_replace(
                        rtrim(
                          rtrim(to_char(length_inches::double precision, 'FM999990.99'), '0'),
                          '.'
                        ),
                        '^$',
                        '0'
                      )
                    ELSE ''
                  END
                )
              )
          END AS len_part,
          NULLIF(
            trim(
              COALESCE(
                NULLIF(trim(width_inches_display), ''),
                CASE
                  WHEN width IS NOT NULL THEN
                    regexp_replace(
                      rtrim(rtrim(to_char(width::double precision, 'FM999990.99'), '0'), '.'),
                      '^$',
                      '0'
                    )
                END,
                ''
              )
            ),
            ''
          ) AS w_part,
          NULLIF(
            trim(
              COALESCE(
                NULLIF(trim(thickness_inches_display), ''),
                CASE
                  WHEN thickness IS NOT NULL THEN
                    regexp_replace(
                      rtrim(rtrim(to_char(thickness::double precision, 'FM999990.99'), '0'), '.'),
                      '^$',
                      '0'
                    )
                END,
                ''
              )
            ),
            ''
          ) AS t_part,
          NULLIF(
            trim(
              COALESCE(
                CASE
                  WHEN
                    trim(
                      regexp_replace(
                        trim(COALESCE(volume_display, '')),
                        '[[:space:]]*[lL][[:space:]]*$',
                        '',
                        'g'
                      )
                    ) <> ''
                  THEN
                    concat(
                      trim(
                        regexp_replace(
                          trim(COALESCE(volume_display, '')),
                          '[[:space:]]*[lL][[:space:]]*$',
                          '',
                          'g'
                        )
                      ),
                      'L'
                    )
                  WHEN volume IS NOT NULL THEN
                    concat(
                      regexp_replace(
                        rtrim(rtrim(to_char(volume::double precision, 'FM999990.99'), '0'), '.'),
                        '^$',
                        '0'
                      ),
                      'L'
                    )
                  ELSE NULL
                END,
                ''
              )
            ),
            ''
          ) AS v_part
        FROM public.listings
      ),
      composed AS (
        SELECT
          id,
          concat_ws(' ', len_part, w_part, t_part, v_part) AS inner_d
        FROM parts
        WHERE len_part IS NOT NULL
          AND trim(both ' ' FROM len_part::text) <> ''
          AND w_part IS NOT NULL
          AND t_part IS NOT NULL
          AND v_part IS NOT NULL
      )
      UPDATE public.listings l
      SET dimensions = '(' || c.inner_d || ')'
      FROM composed c
      WHERE l.id = c.id
        AND (l.dimensions IS NULL OR trim(l.dimensions) = '');
    $sql$;
  END IF;

  -- Path B: numeric columns already gone — best-effort from display columns only.
  -- Length is accepted only when length_inches_display contains a foot mark (e.g. 5'11).
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'length_feet'
  )
     AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'length_inches_display'
  )
     AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'width_inches_display'
  )
     AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'thickness_inches_display'
  )
     AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'volume_display'
  ) THEN
    EXECUTE $sql$
      WITH parts AS (
        SELECT
          id,
          CASE
            WHEN position(chr(39) IN coalesce(trim(length_inches_display), '')) > 0 THEN
              trim(length_inches_display)
          END AS len_part,
          NULLIF(trim(coalesce(width_inches_display, '')), '') AS w_part,
          NULLIF(trim(coalesce(thickness_inches_display, '')), '') AS t_part,
          NULLIF(
            trim(
              COALESCE(
                CASE
                  WHEN
                    trim(
                      regexp_replace(
                        trim(COALESCE(volume_display, '')),
                        '[[:space:]]*[lL][[:space:]]*$',
                        '',
                        'g'
                      )
                    ) <> ''
                  THEN
                    concat(
                      trim(
                        regexp_replace(
                          trim(COALESCE(volume_display, '')),
                          '[[:space:]]*[lL][[:space:]]*$',
                          '',
                          'g'
                        )
                      ),
                      'L'
                    )
                  ELSE NULL
                END,
                ''
              )
            ),
            ''
          ) AS v_part
        FROM public.listings
      ),
      composed AS (
        SELECT
          id,
          concat_ws(' ', len_part, w_part, t_part, v_part) AS inner_d
        FROM parts
        WHERE len_part IS NOT NULL
          AND trim(both ' ' FROM len_part) <> ''
          AND w_part IS NOT NULL
          AND t_part IS NOT NULL
          AND v_part IS NOT NULL
      )
      UPDATE public.listings l
      SET dimensions = '(' || c.inner_d || ')'
      FROM composed c
      WHERE l.id = c.id
        AND (l.dimensions IS NULL OR trim(l.dimensions) = '');
    $sql$;
  END IF;
END $$;

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS length_inches_display,
  DROP COLUMN IF EXISTS width_inches_display,
  DROP COLUMN IF EXISTS thickness_inches_display,
  DROP COLUMN IF EXISTS volume_display;
