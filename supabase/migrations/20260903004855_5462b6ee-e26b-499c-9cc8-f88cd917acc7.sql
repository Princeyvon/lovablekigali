CREATE TABLE public.library_skills (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_path text,
  file_name text,
  link text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_skills TO authenticated;
GRANT ALL ON public.library_skills TO service_role;
ALTER TABLE public.library_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can manage skills" ON public.library_skills FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.library_themes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  image_path text not null,
  source_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_themes TO authenticated;
GRANT ALL ON public.library_themes TO service_role;
ALTER TABLE public.library_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can manage themes" ON public.library_themes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.library_prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  body text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_prompts TO authenticated;
GRANT ALL ON public.library_prompts TO service_role;
ALTER TABLE public.library_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can manage prompts" ON public.library_prompts FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.library_prompts (title, category, body) VALUES
('Repeatable UI section prompt', 'UI', 'Build a responsive section with a semantic heading, supporting copy and one primary action. Use existing design tokens only, no hardcoded colors.'),
('AI assistant scaffold', 'AI', 'Create an assistant panel with streaming responses, message history, and a compact composer. Handle loading, empty and error states.'),
('Notifications panel', 'UI', 'Create a notifications dropdown with unread count badge, grouped items, and a See all link to a full page.');