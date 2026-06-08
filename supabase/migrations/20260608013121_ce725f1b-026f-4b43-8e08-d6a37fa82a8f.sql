ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_service_check;

ALTER TABLE public.api_keys
ADD CONSTRAINT api_keys_service_check
CHECK (
  service = ANY (
    ARRAY[
      'agentrouter'::text,
      'serper'::text,
      'firecrawl'::text,
      'wavespeed'::text,
      'deepgram'::text,
      'lemondata'::text,
      'hyperbrowser'::text,
      'leonardo'::text,
      'manus'::text,
      'media'::text
    ]
  )
);