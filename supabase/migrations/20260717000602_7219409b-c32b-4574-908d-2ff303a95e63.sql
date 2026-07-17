CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name',
                     NEW.raw_user_meta_data->>'name',
                     split_part(NEW.email,'@',1)),
            NEW.raw_user_meta_data->>'avatar_url')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user profiles: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'free') ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user user_roles: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_credits (user_id, free_balance, lifetime_purchased)
    VALUES (NEW.id, 100, 0)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
    VALUES (NEW.id, 100, 'signup_bonus',
            '{"bucket":"free","note":"Welcome bonus"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user credits: %', SQLERRM;
  END;

  RETURN NEW;
END $$;