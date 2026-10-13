ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS notes text, ADD COLUMN IF NOT EXISTS estimated_value numeric;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','projects','prospects','payments','subscriptions','lovable_accounts','project_accounts','project_transfers','expenses','team_payouts','team_members','transactions','library_prompts','library_skills','library_themes','client_notes','service_logs','commissions','payment_reminders','client_credentials','client_system_users','referrals','user_page_access','profiles']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;