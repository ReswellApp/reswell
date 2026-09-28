CREATE UNIQUE INDEX IF NOT EXISTS email_studio_flows_klaviyo_flow_id_unique_idx
  ON public.email_studio_flows (klaviyo_flow_id)
  WHERE klaviyo_flow_id IS NOT NULL;
