CREATE OR REPLACE FUNCTION public.is_team_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.user_roles where user_id = auth.uid());
$$;

DROP POLICY IF EXISTS "team read" ON public.team_members;
CREATE POLICY "team read" ON public.team_members FOR SELECT TO authenticated
  USING (public.is_staff() OR user_id = auth.uid());

DROP POLICY IF EXISTS "referrals read" ON public.referrals;
CREATE POLICY "referrals read" ON public.referrals FOR SELECT TO authenticated
  USING (public.is_staff() OR referring_rep_id = public.my_member_id());

DROP POLICY IF EXISTS "snapshots read" ON public.weekly_snapshots;
CREATE POLICY "snapshots read" ON public.weekly_snapshots FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Team can manage skills" ON public.library_skills;
CREATE POLICY "Team can manage skills" ON public.library_skills FOR ALL TO authenticated
  USING (public.is_team_member()) WITH CHECK (public.is_team_member());
DROP POLICY IF EXISTS "Team can manage themes" ON public.library_themes;
CREATE POLICY "Team can manage themes" ON public.library_themes FOR ALL TO authenticated
  USING (public.is_team_member()) WITH CHECK (public.is_team_member());
DROP POLICY IF EXISTS "Team can manage prompts" ON public.library_prompts;
CREATE POLICY "Team can manage prompts" ON public.library_prompts FOR ALL TO authenticated
  USING (public.is_team_member()) WITH CHECK (public.is_team_member());

DROP POLICY IF EXISTS "Team can read library files" ON storage.objects;
CREATE POLICY "Team can read library files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'library' AND public.is_team_member());
DROP POLICY IF EXISTS "Team can upload library files" ON storage.objects;
CREATE POLICY "Team can upload library files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'library' AND public.is_team_member() AND owner_id = (select auth.uid()::text));
DROP POLICY IF EXISTS "Team can update library files" ON storage.objects;
CREATE POLICY "Team can update library files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'library' AND (owner_id = (select auth.uid()::text) OR public.is_admin()));
DROP POLICY IF EXISTS "Team can delete library files" ON storage.objects;
CREATE POLICY "Team can delete library files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'library' AND (owner_id = (select auth.uid()::text) OR public.is_admin()));
DROP POLICY IF EXISTS "avatars read authenticated" ON storage.objects;
CREATE POLICY "avatars read authenticated" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = (select auth.uid()::text) OR public.is_team_member()));