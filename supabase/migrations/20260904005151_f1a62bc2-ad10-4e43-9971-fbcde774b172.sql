ALTER TABLE public.library_skills ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.library_themes ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.library_prompts ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH r AS (SELECT id, row_number() OVER (ORDER BY created_at DESC) AS n FROM public.library_skills)
UPDATE public.library_skills s SET sort_order = r.n FROM r WHERE r.id = s.id;
WITH r AS (SELECT id, row_number() OVER (ORDER BY created_at DESC) AS n FROM public.library_themes)
UPDATE public.library_themes s SET sort_order = r.n FROM r WHERE r.id = s.id;
WITH r AS (SELECT id, row_number() OVER (ORDER BY created_at DESC) AS n FROM public.library_prompts)
UPDATE public.library_prompts s SET sort_order = r.n FROM r WHERE r.id = s.id;