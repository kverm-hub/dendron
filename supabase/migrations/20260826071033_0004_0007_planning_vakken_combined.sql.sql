/*
# Planning tijdsinschatting, vak-code, seed-vakken, starttijd

1. Modified Tables
- planning_items: +estimated_minutes (optionele tijdsinschatting in minuten)
- subjects: +code (korte code zoals 'WI' voor Wiskunde, unique per gezin)
2. Data
- Seed standaardvakken (Wiskunde, Aardrijkskunde, etc.) voor bestaande ouders
3. Modified Tables
- planning_items: +start_time (optionele klokstip voor agenda-tijdlijn)
*/

ALTER TABLE public.planning_items
  ADD COLUMN IF NOT EXISTS estimated_minutes integer CHECK (estimated_minutes IS NULL OR estimated_minutes > 0);

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS code text;

DO $$ BEGIN
  ALTER TABLE public.subjects ADD CONSTRAINT subjects_family_code_unique UNIQUE (family_id, code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.subjects (family_id, name, code, icon, created_by)
SELECT p.family_id, v.name, v.code, v.icon, p.id
FROM public.profiles p
CROSS JOIN (
  VALUES
    ('Wiskunde', 'WI', 'calculator'),
    ('Aardrijkskunde', 'AK', 'globe'),
    ('Duits', 'DU', 'language'),
    ('Engels', 'EN', 'language'),
    ('Frans', 'FA', 'language'),
    ('Geschiedenis', 'GS', 'history'),
    ('Levensbeschouwing', 'LS', 'book-open'),
    ('Nederlands', 'NE', 'language'),
    ('Natuurkunde/Scheikunde', 'NS', 'flask')
) AS v(name, code, icon)
WHERE p.role = 'ouder'
ON CONFLICT (family_id, code) DO NOTHING;

ALTER TABLE public.planning_items
  ADD COLUMN IF NOT EXISTS start_time time;
