-- Inactive winback: single 30-day tier only (remove 3 / 15 day milestones).

DELETE FROM public.klaviyo_inactivity_milestones
WHERE milestone_days IN (3, 15);

ALTER TABLE public.klaviyo_inactivity_milestones
  DROP CONSTRAINT IF EXISTS klaviyo_inactivity_milestones_milestone_days_check;

ALTER TABLE public.klaviyo_inactivity_milestones
  ADD CONSTRAINT klaviyo_inactivity_milestones_milestone_days_check
  CHECK (milestone_days = 30);
