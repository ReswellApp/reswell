-- Reassign magazine listings to the dedicated seller profile (haydensbsb@gmail.com).
-- Admin users create listings; public marketplace shows them under this seller account.

UPDATE public.listings AS l
SET user_id = p.id
FROM public.profiles AS p
WHERE l.section = 'magazines'
  AND lower(trim(p.email)) = lower(trim('haydensbsb@gmail.com'))
  AND l.user_id IS DISTINCT FROM p.id;
