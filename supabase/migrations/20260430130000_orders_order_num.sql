-- Public-facing 6-character order reference; unique, assigned on insert when not provided.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_num text;

-- Backfill existing rows with unique random codes (Crockford-like alphabet: no I, O, 0, 1).
DO $$
DECLARE
  r record;
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  j int;
BEGIN
  FOR r IN SELECT id FROM public.orders WHERE order_num IS NULL OR trim(order_num) = '' LOOP
    LOOP
      candidate := '';
      FOR j IN 1..6 LOOP
        candidate := candidate || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.orders o WHERE o.order_num = candidate
      );
    END LOOP;
    UPDATE public.orders SET order_num = candidate WHERE id = r.id;
  END LOOP;
END;
$$;

ALTER TABLE public.orders ALTER COLUMN order_num SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_num_uidx ON public.orders (order_num);

COMMENT ON COLUMN public.orders.order_num IS
  'Unique 6-character public order reference; generated on insert when omitted.';

CREATE OR REPLACE FUNCTION public.orders_set_order_num()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  j int;
  attempts int := 0;
BEGIN
  IF NEW.order_num IS NOT NULL AND btrim(NEW.order_num) <> '' THEN
    RETURN NEW;
  END IF;

  LOOP
    candidate := '';
    FOR j IN 1..6 LOOP
      candidate := candidate || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.order_num = candidate) THEN
      NEW.order_num := candidate;
      RETURN NEW;
    END IF;
    attempts := attempts + 1;
    IF attempts > 200 THEN
      RAISE EXCEPTION 'orders_set_order_num: could not allocate unique order_num';
    END IF;
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS orders_before_insert_order_num ON public.orders;
CREATE TRIGGER orders_before_insert_order_num
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_set_order_num();
