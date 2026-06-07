
-- Saved payment methods (require admin approval before use)
CREATE TABLE IF NOT EXISTS public.user_payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  method_type TEXT NOT NULL DEFAULT 'custom',
  label TEXT NOT NULL,
  instructions TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_payment_methods TO authenticated;
GRANT ALL ON public.user_payment_methods TO service_role;

ALTER TABLE public.user_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payment methods"
  ON public.user_payment_methods FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own payment methods"
  ON public.user_payment_methods FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Users delete own payment methods"
  ON public.user_payment_methods FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user ON public.user_payment_methods(user_id);

-- Extend withdrawal_requests
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES public.user_payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_address TEXT,
  ADD COLUMN IF NOT EXISTS admin_note TEXT,
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_pm_updated_at ON public.user_payment_methods;
CREATE TRIGGER trg_pm_updated_at
  BEFORE UPDATE ON public.user_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
