
-- 1. Allow manus + media services
CREATE OR REPLACE FUNCTION public.admin_add_api_key(p_service text, p_key text, p_label text DEFAULT NULL::text, p_credit_limit numeric DEFAULT 5)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid;
BEGIN
  IF p_service NOT IN ('serper','firecrawl','leonardo','manus','media') THEN
    RAISE EXCEPTION 'unsupported service: %', p_service;
  END IF;
  IF p_key IS NULL OR length(trim(p_key)) < 8 THEN
    RAISE EXCEPTION 'invalid key';
  END IF;

  INSERT INTO public.api_keys (service, api_key, label, is_active, is_blocked, credit_limit_usd)
  VALUES (p_service, trim(p_key), COALESCE(p_label, p_service || ' key'), true, false, COALESCE(p_credit_limit, 5))
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

-- 2. Free image uses counter
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS image_free_uses integer NOT NULL DEFAULT 0;

-- 3. Paid plan helpers (Pro $25/mo = 2500 cents, Elite $50/mo = 5000 cents)
CREATE OR REPLACE FUNCTION public.has_paid_plan(p_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = p_user_id AND s.status = 'active'
      AND COALESCE(s.amount_cents, 0) >= 2400
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.has_elite_plan(p_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = p_user_id AND s.status = 'active'
      AND COALESCE(s.amount_cents, 0) >= 4900
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
$$;

-- 4. Consume free image use (3 per lifetime for non-paid users)
CREATE OR REPLACE FUNCTION public.consume_free_image_use(p_user_id uuid, p_limit integer DEFAULT 3)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_used integer;
BEGIN
  SELECT image_free_uses INTO v_used FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_used IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;
  IF v_used >= p_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'free_trial_exhausted', 'used', v_used, 'limit', p_limit);
  END IF;
  UPDATE public.profiles SET image_free_uses = image_free_uses + 1, updated_at = now()
    WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true, 'used', v_used + 1, 'remaining', p_limit - v_used - 1);
END;
$$;

-- 5. Insert Megsy models
INSERT INTO public.fal_image_models (slug, display_name, provider, description, endpoint_text_to_image, endpoint_image_to_image, unit, fal_unit_cost_usd, credits, supports_multi_image, max_input_images, supported_aspects, supported_resolutions, default_aspect, default_resolution, is_premium, is_new, is_featured, sort_order, is_active, api_version)
VALUES ('megsy-image', 'Megsy Image', 'megsy', 'Megsy''s flagship image model — free trial available, unlimited for paid plans.', 'wan2.5-t2i-preview', 'wan2.5-i2i-preview', 'image', 0, 0, true, 4, '["1:1","3:2","2:3","16:9","9:16","4:3","3:4"]'::jsonb, '["1K","2K"]'::jsonb, '1:1', '1K', false, true, true, 1, true, 'v2')
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_featured = true,
  sort_order = 1,
  is_active = true,
  credits = 0;

INSERT INTO public.fal_video_models (slug, display_name, provider, description, endpoint_text_to_video, endpoint_image_to_video, unit, cost_per_second_usd, credits_per_second, supports_multi_image, max_input_images, supports_start_end_frame, supports_audio, supported_aspects, supported_resolutions, supported_durations, default_aspect, default_resolution, default_duration, is_premium, is_new, is_featured, sort_order, is_active)
VALUES ('megsy-video', 'Megsy Video', 'megsy', 'Megsy''s flagship video model — unlimited for Elite and Business plans.', 'wan2.5-t2v-preview', 'wan2.5-i2v-preview', 'second', 0, 0, false, 1, false, true, '["16:9","9:16","1:1"]'::jsonb, '["720p","1080p"]'::jsonb, '[5,10]'::jsonb, '16:9', '720p', 5, true, true, true, 1, true)
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_featured = true,
  sort_order = 1,
  is_active = true,
  credits_per_second = 0;
