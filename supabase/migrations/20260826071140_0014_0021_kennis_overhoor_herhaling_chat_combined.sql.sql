/*
# Overhoor-hoofdstuk, herhaling-groep, kennis-onderdelen, paragraaf-context, coachaanpak/videos, chat-afbeelding, woordenlijsten, rooster-starttijd

1. Modified Tables
- overhoor_sessies: +hoofdstuk text (welk hoofdstuk geoefend is)
- planning_items: +herhaling_groep_id uuid (gelinkte herhalings-items)
- kennis_paragraaf_context: +coachaanpak text, +videos jsonb
- chat_messages: +image_path text (foto per chatbericht)
- opdracht_berichten: +image_path text
- planning_items: +rooster_start_tijd time (bronlesuur herkenning)
2. New Tables
- kennis_onderdelen: kennisbank op regel-niveau (regel/voorbeelden/tip/uitzondering)
- kennis_paragraaf_context: paragraafbrede context (leerdoelen/voorkennis/kernbegrippen)
- kennis_oefenvragen: kant-en-klare oefenvragen (vraag+antwoord+uitwerking)
- kennis_woordenlijsten: woordparen-lijsten voor taalvakken
3. Security
- RLS on all new tables
- Policies: gezin leest, ouder beheert
*/

ALTER TABLE public.overhoor_sessies
  ADD COLUMN IF NOT EXISTS hoofdstuk text;

ALTER TABLE public.planning_items
  ADD COLUMN IF NOT EXISTS herhaling_groep_id uuid;

CREATE INDEX IF NOT EXISTS planning_items_herhaling_groep_idx
  ON public.planning_items (herhaling_groep_id)
  WHERE herhaling_groep_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.kennis_onderdelen (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  hoofdstuk text not null,
  paragraaf_id text,
  naam text not null,
  volgorde integer not null default 0,
  regel text not null,
  voorbeelden jsonb not null default '[]'::jsonb,
  gecombineerd_voorbeeld text,
  tip text,
  uitzondering text,
  fout_voorbeeld text,
  status text not null check (status in ('concept', 'gepubliceerd')) default 'concept',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS kennis_onderdelen_subject_idx ON public.kennis_onderdelen (subject_id);
CREATE INDEX IF NOT EXISTS kennis_onderdelen_subject_hoofdstuk_idx ON public.kennis_onderdelen (subject_id, hoofdstuk);

ALTER TABLE public.kennis_onderdelen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kennis_onderdelen: select family" ON public.kennis_onderdelen;
CREATE POLICY "kennis_onderdelen: select family" ON public.kennis_onderdelen
  FOR SELECT USING (family_id = public.current_family_id());
DROP POLICY IF EXISTS "kennis_onderdelen: insert by ouder" ON public.kennis_onderdelen;
CREATE POLICY "kennis_onderdelen: insert by ouder" ON public.kennis_onderdelen
  FOR INSERT WITH CHECK (family_id = public.current_family_id() AND public.current_role() = 'ouder');
DROP POLICY IF EXISTS "kennis_onderdelen: update by ouder" ON public.kennis_onderdelen;
CREATE POLICY "kennis_onderdelen: update by ouder" ON public.kennis_onderdelen
  FOR UPDATE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');
DROP POLICY IF EXISTS "kennis_onderdelen: delete by ouder" ON public.kennis_onderdelen;
CREATE POLICY "kennis_onderdelen: delete by ouder" ON public.kennis_onderdelen
  FOR DELETE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');

CREATE TABLE IF NOT EXISTS public.kennis_paragraaf_context (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  hoofdstuk text not null,
  paragraaf_id text not null,
  titel text not null,
  leerdoelen text,
  voorkennis text,
  kernbegrippen text,
  oplossingsroute text,
  beheersingscriterium text,
  coachaanpak text,
  videos jsonb not null default '[]'::jsonb,
  status text not null check (status in ('concept', 'gepubliceerd')) default 'concept',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, paragraaf_id)
);

CREATE INDEX IF NOT EXISTS kennis_paragraaf_context_subject_idx ON public.kennis_paragraaf_context (subject_id);

ALTER TABLE public.kennis_paragraaf_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kennis_paragraaf_context: select family" ON public.kennis_paragraaf_context;
CREATE POLICY "kennis_paragraaf_context: select family" ON public.kennis_paragraaf_context
  FOR SELECT USING (family_id = public.current_family_id());
DROP POLICY IF EXISTS "kennis_paragraaf_context: insert by ouder" ON public.kennis_paragraaf_context;
CREATE POLICY "kennis_paragraaf_context: insert by ouder" ON public.kennis_paragraaf_context
  FOR INSERT WITH CHECK (family_id = public.current_family_id() AND public.current_role() = 'ouder');
DROP POLICY IF EXISTS "kennis_paragraaf_context: update by ouder" ON public.kennis_paragraaf_context;
CREATE POLICY "kennis_paragraaf_context: update by ouder" ON public.kennis_paragraaf_context
  FOR UPDATE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');
DROP POLICY IF EXISTS "kennis_paragraaf_context: delete by ouder" ON public.kennis_paragraaf_context;
CREATE POLICY "kennis_paragraaf_context: delete by ouder" ON public.kennis_paragraaf_context
  FOR DELETE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');

CREATE TABLE IF NOT EXISTS public.kennis_oefenvragen (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  hoofdstuk text not null,
  paragraaf_id text not null,
  kennis_onderdeel_id uuid references public.kennis_onderdelen (id) on delete set null,
  niveau text,
  vraag text not null,
  antwoord text not null,
  uitwerking text,
  volgorde integer not null default 0,
  status text not null check (status in ('concept', 'gepubliceerd')) default 'concept',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS kennis_oefenvragen_subject_idx ON public.kennis_oefenvragen (subject_id);
CREATE INDEX IF NOT EXISTS kennis_oefenvragen_subject_paragraaf_idx ON public.kennis_oefenvragen (subject_id, paragraaf_id);
CREATE INDEX IF NOT EXISTS kennis_oefenvragen_onderdeel_idx ON public.kennis_oefenvragen (kennis_onderdeel_id);

ALTER TABLE public.kennis_oefenvragen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kennis_oefenvragen: select family" ON public.kennis_oefenvragen;
CREATE POLICY "kennis_oefenvragen: select family" ON public.kennis_oefenvragen
  FOR SELECT USING (family_id = public.current_family_id());
DROP POLICY IF EXISTS "kennis_oefenvragen: insert by ouder" ON public.kennis_oefenvragen;
CREATE POLICY "kennis_oefenvragen: insert by ouder" ON public.kennis_oefenvragen
  FOR INSERT WITH CHECK (family_id = public.current_family_id() AND public.current_role() = 'ouder');
DROP POLICY IF EXISTS "kennis_oefenvragen: update by ouder" ON public.kennis_oefenvragen;
CREATE POLICY "kennis_oefenvragen: update by ouder" ON public.kennis_oefenvragen
  FOR UPDATE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');
DROP POLICY IF EXISTS "kennis_oefenvragen: delete by ouder" ON public.kennis_oefenvragen;
CREATE POLICY "kennis_oefenvragen: delete by ouder" ON public.kennis_oefenvragen
  FOR DELETE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');

CREATE TABLE IF NOT EXISTS public.kennis_woordenlijsten (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  hoofdstuk text not null,
  paragraaf_id text not null,
  titel text not null,
  richting text not null default 'gemengd' check (richting in ('bron_naar_doel', 'doel_naar_bron', 'gemengd')),
  woorden jsonb not null default '[]',
  volgorde integer not null default 0,
  status text not null check (status in ('concept', 'gepubliceerd')) default 'concept',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS kennis_woordenlijsten_subject_idx ON public.kennis_woordenlijsten (subject_id);
CREATE INDEX IF NOT EXISTS kennis_woordenlijsten_subject_paragraaf_idx ON public.kennis_woordenlijsten (subject_id, paragraaf_id);

ALTER TABLE public.kennis_woordenlijsten ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kennis_woordenlijsten: select family" ON public.kennis_woordenlijsten;
CREATE POLICY "kennis_woordenlijsten: select family" ON public.kennis_woordenlijsten
  FOR SELECT USING (family_id = public.current_family_id());
DROP POLICY IF EXISTS "kennis_woordenlijsten: insert by ouder" ON public.kennis_woordenlijsten;
CREATE POLICY "kennis_woordenlijsten: insert by ouder" ON public.kennis_woordenlijsten
  FOR INSERT WITH CHECK (family_id = public.current_family_id() AND public.current_role() = 'ouder');
DROP POLICY IF EXISTS "kennis_woordenlijsten: update by ouder" ON public.kennis_woordenlijsten;
CREATE POLICY "kennis_woordenlijsten: update by ouder" ON public.kennis_woordenlijsten
  FOR UPDATE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');
DROP POLICY IF EXISTS "kennis_woordenlijsten: delete by ouder" ON public.kennis_woordenlijsten;
CREATE POLICY "kennis_woordenlijsten: delete by ouder" ON public.kennis_woordenlijsten
  FOR DELETE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS image_path text;

ALTER TABLE public.opdracht_berichten
  ADD COLUMN IF NOT EXISTS image_path text;

ALTER TABLE public.planning_items
  ADD COLUMN IF NOT EXISTS rooster_start_tijd time;
