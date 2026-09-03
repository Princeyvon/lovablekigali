CREATE POLICY "Team can read library files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'library');
CREATE POLICY "Team can upload library files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'library');
CREATE POLICY "Team can update library files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'library');
CREATE POLICY "Team can delete library files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'library');