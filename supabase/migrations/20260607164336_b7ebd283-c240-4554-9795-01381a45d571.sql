
CREATE TABLE public.code_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.code_prompts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_prompts TO authenticated;
GRANT ALL ON public.code_prompts TO service_role;

ALTER TABLE public.code_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view code prompts"
  ON public.code_prompts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can insert own prompts"
  ON public.code_prompts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authors can update own prompts"
  ON public.code_prompts FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authors can delete own prompts"
  ON public.code_prompts FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE INDEX code_prompts_created_at_idx ON public.code_prompts (created_at DESC);
